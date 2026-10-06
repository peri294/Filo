import { randomBytes, randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma, getSettings, type Settings } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { consume, isLimited } from "@/lib/rate-limit";
import { hoursFor, parseWeeklyHours } from "@/lib/schedule";
import {
  addDaysToKey,
  formatTime,
  isDateKey,
  isTimeKey,
  minutesOf,
  todayKey,
  weekdayOf,
  zonedInstant,
} from "@/lib/time";

export const ACTIVE_STATUSES = ["PENDIENTE_WHATSAPP", "PENDIENTE_PAGO", "CONFIRMADO"];
const PENDING_STATUSES = ["PENDIENTE_WHATSAPP", "PENDIENTE_PAGO"];

export const CASH_HOLD_MIN = 15;
/** Cuánto más se retiene el horario después de que el cliente avisa que mandó el WhatsApp. */
export const NOTIFIED_HOLD_HOURS = 12;
export const SELF_CANCEL_MIN_HOURS = 24;
/** Tamaño fijo de cada SlotLock. No depende de la grilla configurada, así cambiarla no rompe nada. */
export const LOCK_UNIT_MIN = 5;
const MAX_BOOKINGS_PER_IP_PER_HOUR = 3;
const LOOKUP_WINDOW_MS = 15 * 60_000;
const MAX_LOOKUPS_PER_IP = 10;
const MAX_LOOKUP_FAILS_PER_CODE = 5;

const MINUTE = 60_000;

export class BookingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

type Tx = Prisma.TransactionClient;

/** Libera el horario y el celular de turnos cancelados. */
async function releaseHolds(tx: Tx, where: Prisma.AppointmentWhereInput) {
  await tx.slotLock.deleteMany({ where: { appointment: where } });
  await tx.phoneHold.deleteMany({ where: { appointment: where } });
}

/**
 * Cancela las reservas provisorias vencidas y libera sus horarios.
 * Se llama antes de leer o modificar la agenda, así no hace falta un cron.
 */
export async function releaseExpired() {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.appointment.updateMany({
      where: { status: { in: PENDING_STATUSES }, expiresAt: { lt: now } },
      data: { status: "CANCELADO", cancelReason: "EXPIRADO", cancelledAt: now },
    });
    if (count > 0) await releaseHolds(tx, { status: "CANCELADO" });
  });
}

/** Inicios de cada bloque de unitMin minutos entre start (incluido) y end (excluido). */
function unitStarts(start: Date, end: Date, unitMin: number) {
  const out: Date[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += unitMin * MINUTE) out.push(new Date(t));
  return out;
}

function lockRows(start: Date, end: Date) {
  return unitStarts(start, end, LOCK_UNIT_MIN).map((u) => ({ startsAt: u }));
}

function unitsFor(durationMin: number, settings: Settings) {
  return Math.max(1, Math.ceil(durationMin / settings.slotDurationMin));
}

/** Días que se pueden reservar, desde hoy hasta el límite configurado. */
export function bookableDates(settings: Settings) {
  const hours = parseWeeklyHours(settings.weeklyHours);
  const today = todayKey();
  const dates: string[] = [];
  for (let i = 0; i <= settings.bookingWindowDays; i++) {
    const key = addDaysToKey(today, i);
    if (hours[weekdayOf(key)]) dates.push(key);
  }
  return dates;
}

export type SlotOption = { time: string; available: boolean };

export async function getAvailability(dateKey: string, serviceId: number) {
  if (!isDateKey(dateKey)) throw new BookingError(400, "Fecha inválida");

  const [settings, service] = await Promise.all([
    getSettings(),
    prisma.service.findFirst({ where: { id: serviceId, active: true } }),
  ]);
  if (!service) throw new BookingError(404, "Servicio no encontrado");
  const hours = hoursFor(settings.weeklyHours, dateKey);
  if (!hours || !bookableDates(settings).includes(dateKey)) return { dateKey, open: false, slots: [] };

  await releaseExpired();

  const durationMs = unitsFor(service.durationMin, settings) * settings.slotDurationMin * MINUTE;
  const open = zonedInstant(dateKey, hours.open);
  const close = zonedInstant(dateKey, hours.close);
  const earliest = Date.now() + settings.minNoticeMin * MINUTE;

  const locks = await prisma.slotLock.findMany({
    where: { startsAt: { gte: open, lt: close } },
    select: { startsAt: true },
  });
  const taken = new Set(locks.map((l) => l.startsAt.getTime()));

  const slots: SlotOption[] = [];
  for (const start of unitStarts(open, close, settings.slotDurationMin)) {
    const end = new Date(start.getTime() + durationMs);
    if (end > close) break;
    if (start.getTime() < earliest) continue;
    const free = unitStarts(start, end, LOCK_UNIT_MIN).every((u) => !taken.has(u.getTime()));
    slots.push({ time: formatTime(start), available: free });
  }
  return { dateKey, open: true, slots };
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return `TURN-${code}`;
}

const PHONE_TAKEN = new BookingError(
  409,
  'Ya tenés un turno activo con ese teléfono. Podés verlo o cancelarlo desde "Mi turno".',
);

export type CreateAppointmentInput = {
  serviceId: number;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  paymentMethod: "EFECTIVO" | "MERCADOPAGO";
};

export async function createAppointment(input: CreateAppointmentInput, clientIp: string) {
  if (input.paymentMethod === "MERCADOPAGO") {
    throw new BookingError(400, "El pago con Mercado Pago todavía no está disponible");
  }
  if (!isDateKey(input.date) || !isTimeKey(input.time)) {
    throw new BookingError(400, "Fecha u hora inválida");
  }

  const phone = normalizePhone(input.clientPhone);
  if (!phone) throw new BookingError(400, "Ingresá un celular válido con código de área");
  const now = new Date();

  await releaseExpired();

  // Anti-spam: un solo turno activo por teléfono.
  const activeForPhone = await prisma.appointment.count({
    where: { clientPhone: phone, status: { in: ACTIVE_STATUSES }, endsAt: { gt: now } },
  });
  if (activeForPhone > 0) throw PHONE_TAKEN;

  // Anti-spam: límite de reservas por IP (la IP se comparte en redes móviles, por eso no es 1).
  const recentFromIp = await prisma.appointment.count({
    where: { clientIp, createdAt: { gt: new Date(now.getTime() - 60 * MINUTE) } },
  });
  if (recentFromIp >= MAX_BOOKINGS_PER_IP_PER_HOUR) {
    throw new BookingError(429, "Demasiadas reservas desde tu conexión. Probá de nuevo más tarde.");
  }

  const { slots, open } = await getAvailability(input.date, input.serviceId);
  const slot = slots.find((s) => s.time === input.time);
  if (!open || !slot) throw new BookingError(400, "Ese horario no está disponible para reservar");
  if (!slot.available) throw new BookingError(409, "Ese horario ya está ocupado. Elegí otro.");

  const [settings, service] = await Promise.all([
    getSettings(),
    prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } }),
  ]);
  const startsAt = zonedInstant(input.date, input.time);
  const endsAt = new Date(startsAt.getTime() + unitsFor(service.durationMin, settings) * settings.slotDurationMin * MINUTE);

  // Si el turno anterior de este celular ya pasó, su PhoneHold quedó: se libera acá.
  await prisma.phoneHold.deleteMany({
    where: { phone, appointment: { OR: [{ status: "CANCELADO" }, { endsAt: { lte: now } }] } },
  });

  try {
    return await prisma.appointment.create({
      data: {
        code: generateCode(),
        accessToken: randomBytes(24).toString("base64url"),
        startsAt,
        endsAt,
        clientName: input.clientName.trim(),
        clientPhone: phone,
        clientIp,
        serviceId: service.id,
        price: service.price,
        paymentMethod: input.paymentMethod,
        status: "PENDIENTE_WHATSAPP",
        expiresAt: new Date(now.getTime() + CASH_HOLD_MIN * MINUTE),
        slotLocks: { create: lockRows(startsAt, endsAt) },
        phoneHold: { create: { phone } },
      },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Llegaron dos reservas al mismo tiempo: decide la restricción única que haya chocado.
    if (await prisma.phoneHold.findUnique({ where: { phone } })) throw PHONE_TAKEN;
    throw new BookingError(409, "Ese horario se acaba de ocupar. Elegí otro.");
  }
}

export async function getAppointmentByToken(token: string) {
  await releaseExpired();
  return prisma.appointment.findUnique({ where: { accessToken: token }, include: { service: true } });
}

/**
 * El cliente indica que ya mandó el WhatsApp. Como no se puede comprobar, no anula el
 * vencimiento: lo extiende NOTIFIED_HOLD_HOURS (sin pasar el inicio del turno) para darle
 * tiempo al barbero a confirmar.
 */
export async function markClientNotified(token: string) {
  await releaseExpired();
  const now = new Date();
  const appt = await prisma.appointment.findUnique({ where: { accessToken: token }, select: { startsAt: true } });
  if (!appt) throw new BookingError(404, "Turno no encontrado");
  const holdUntil = Math.min(now.getTime() + NOTIFIED_HOLD_HOURS * 60 * MINUTE, appt.startsAt.getTime());
  const { count } = await prisma.appointment.updateMany({
    where: {
      accessToken: token,
      status: "PENDIENTE_WHATSAPP",
      clientNotifiedAt: null,
      expiresAt: { gt: now },
    },
    data: { clientNotifiedAt: now, expiresAt: new Date(Math.max(holdUntil, now.getTime() + CASH_HOLD_MIN * MINUTE)) },
  });
  if (count === 0) throw new BookingError(409, "El turno ya no está pendiente de confirmación");
}

export function canSelfCancel(appt: { status: string; startsAt: Date }) {
  return (
    ACTIVE_STATUSES.includes(appt.status) &&
    appt.startsAt.getTime() - Date.now() > SELF_CANCEL_MIN_HOURS * 60 * MINUTE
  );
}

/** Cancela solo si el turno sigue en alguno de los estados esperados. Devuelve si lo canceló. */
async function cancel(id: string, reason: string, from: string[]) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.appointment.updateMany({
      where: { id, status: { in: from } },
      data: { status: "CANCELADO", cancelReason: reason, cancelledAt: new Date() },
    });
    if (count > 0) await releaseHolds(tx, { id });
    return count > 0;
  });
}

export async function cancelByClient(token: string) {
  const appt = await getAppointmentByToken(token);
  if (!appt) throw new BookingError(404, "Turno no encontrado");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new BookingError(409, "El turno ya está cancelado");
  if (!canSelfCancel(appt)) {
    throw new BookingError(
      400,
      `Faltan menos de ${SELF_CANCEL_MIN_HOURS} horas para el turno. Para cancelarlo comunicate con la barbería por WhatsApp.`,
    );
  }
  // TODO(Mercado Pago): si el turno está pago, devolver el 100% antes de cancelar.
  if (!(await cancel(appt.id, "CLIENTE", ACTIVE_STATUSES))) throw new BookingError(409, "El turno ya está cancelado");
}

export async function lookupAppointment(code: string, phone: string, clientIp: string) {
  const normalizedCode = code.trim().toUpperCase();
  const codeKey = `lookup:code:${normalizedCode}`;
  const tooMany = new BookingError(429, "Demasiados intentos. Probá de nuevo en unos minutos.");
  if (!(await consume(`lookup:ip:${clientIp}`, MAX_LOOKUPS_PER_IP, LOOKUP_WINDOW_MS))) throw tooMany;
  if (await isLimited(codeKey, MAX_LOOKUP_FAILS_PER_CODE)) throw tooMany;

  await releaseExpired();
  const appt = await prisma.appointment.findUnique({
    where: { code: normalizedCode },
    select: { accessToken: true, clientPhone: true },
  });
  // Mismo error si no existe o si el teléfono no coincide, para no revelar códigos válidos.
  if (!appt || appt.clientPhone !== normalizePhone(phone)) {
    await consume(codeKey, MAX_LOOKUP_FAILS_PER_CODE, LOOKUP_WINDOW_MS);
    throw new BookingError(404, "No encontramos un turno con ese código y teléfono");
  }
  return appt.accessToken;
}

// ---------- Panel del barbero ----------

export async function adminConfirm(id: string) {
  await releaseExpired();
  const { count } = await prisma.appointment.updateMany({
    where: { id, status: "PENDIENTE_WHATSAPP" },
    data: { status: "CONFIRMADO", confirmedAt: new Date(), expiresAt: null },
  });
  if (count === 0) throw new BookingError(409, "El turno ya no está pendiente (puede haber vencido)");
}

export async function adminReject(id: string) {
  await releaseExpired();
  if (!(await cancel(id, "RECHAZADO", ["PENDIENTE_WHATSAPP"]))) {
    throw new BookingError(409, "El turno ya no está pendiente");
  }
}

export async function adminCancel(id: string) {
  await releaseExpired();
  // TODO(Mercado Pago): si el turno está pago, ofrecer el reembolso total.
  if (!(await cancel(id, "BARBERO", ACTIVE_STATUSES))) throw new BookingError(409, "El turno ya está cancelado");
}

export async function createBlock(dateKey: string, from: string, to: string, reason?: string) {
  if (!isDateKey(dateKey) || !isTimeKey(from) || !isTimeKey(to)) throw new BookingError(400, "Datos inválidos");
  const settings = await getSettings();
  const hours = hoursFor(settings.weeklyHours, dateKey);
  if (!hours) throw new BookingError(400, "Ese día el local está cerrado");
  const unit = settings.slotDurationMin;
  const phase = minutesOf(hours.open) % unit;
  if (minutesOf(from) % unit !== phase || minutesOf(to) % unit !== phase) {
    throw new BookingError(400, `Los horarios tienen que coincidir con la grilla de ${unit} minutos`);
  }
  const startsAt = zonedInstant(dateKey, from);
  const endsAt = zonedInstant(dateKey, to);
  if (endsAt <= startsAt) throw new BookingError(400, "La hora de fin tiene que ser posterior a la de inicio");
  if (minutesOf(from) < minutesOf(hours.open) || minutesOf(to) > minutesOf(hours.close)) {
    throw new BookingError(
      400,
      `El bloqueo tiene que estar dentro del horario de atención (${hours.open} a ${hours.close})`,
    );
  }

  await releaseExpired();
  try {
    await prisma.blockedSlot.create({
      data: {
        startsAt,
        endsAt,
        reason: reason?.trim() || null,
        slotLocks: { create: lockRows(startsAt, endsAt) },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new BookingError(409, "Hay turnos o bloqueos en ese rango. Cancelalos primero o elegí otro horario.");
    }
    throw e;
  }
}

export async function deleteBlock(id: string) {
  // deleteMany no tira error si no existe (delete tiraría P2025 y la API respondería 500).
  const { count } = await prisma.blockedSlot.deleteMany({ where: { id } });
  if (count === 0) throw new BookingError(404, "El bloqueo no existe");
}

/** Lunes de la semana de la fecha dada. */
export function weekStartOf(dateKey: string) {
  return addDaysToKey(dateKey, -((weekdayOf(dateKey) + 6) % 7));
}

export async function getAgenda(dateKey: string) {
  await releaseExpired();
  const settings = await getSettings();
  const dayStart = zonedInstant(dateKey, "00:00");
  const dayEnd = zonedInstant(addDaysToKey(dateKey, 1), "00:00");
  const weekStart = zonedInstant(weekStartOf(dateKey), "00:00");
  const weekEnd = zonedInstant(addDaysToKey(weekStartOf(dateKey), 7), "00:00");

  const [appointments, blocks, pending, week] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: dayStart, lt: dayEnd } },
      include: { service: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.blockedSlot.findMany({
      where: { startsAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { status: "PENDIENTE_WHATSAPP", endsAt: { gt: new Date() } },
      include: { service: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: weekStart, lt: weekEnd }, status: { in: ACTIVE_STATUSES } },
      select: { startsAt: true },
    }),
  ]);

  return { settings, appointments, blocks, pending, week };
}
