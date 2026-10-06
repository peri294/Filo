import { randomBytes, randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma, getSettings, type Settings } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
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
export const SELF_CANCEL_MIN_HOURS = 24;
const MAX_BOOKINGS_PER_IP_PER_HOUR = 3;

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

/**
 * Cancela las reservas provisorias vencidas y libera sus horarios.
 * Se llama antes de leer o modificar la agenda, así no hace falta un cron.
 * Una reserva en efectivo donde el cliente ya avisó por WhatsApp no vence sola.
 */
export async function releaseExpired() {
  const now = new Date();
  const { count } = await prisma.appointment.updateMany({
    where: { status: { in: PENDING_STATUSES }, expiresAt: { lt: now }, clientNotifiedAt: null },
    data: { status: "CANCELADO", cancelReason: "EXPIRADO", cancelledAt: now },
  });
  if (count > 0) {
    await prisma.slotLock.deleteMany({ where: { appointment: { status: "CANCELADO" } } });
  }
}

/** Inicios de cada unidad de agenda entre start (incluido) y end (excluido). */
function unitStarts(start: Date, end: Date, unitMin: number) {
  const out: Date[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += unitMin * MINUTE) out.push(new Date(t));
  return out;
}

function unitsFor(durationMin: number, settings: Settings) {
  return Math.max(1, Math.ceil(durationMin / settings.slotDurationMin));
}

export function openDays(settings: Settings) {
  return new Set(settings.daysOpen.split(",").map((d) => Number(d.trim())));
}

/** Días que se pueden reservar, desde hoy hasta el límite configurado. */
export function bookableDates(settings: Settings) {
  const open = openDays(settings);
  const today = todayKey();
  const dates: string[] = [];
  for (let i = 0; i <= settings.bookingWindowDays; i++) {
    const key = addDaysToKey(today, i);
    if (open.has(weekdayOf(key))) dates.push(key);
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
  if (!bookableDates(settings).includes(dateKey)) return { dateKey, open: false, slots: [] };

  await releaseExpired();

  const unit = settings.slotDurationMin;
  const needed = unitsFor(service.durationMin, settings);
  const open = zonedInstant(dateKey, settings.openingTime);
  const close = zonedInstant(dateKey, settings.closingTime);
  const earliest = Date.now() + settings.minNoticeMin * MINUTE;

  const locks = await prisma.slotLock.findMany({
    where: { startsAt: { gte: open, lt: close } },
    select: { startsAt: true },
  });
  const taken = new Set(locks.map((l) => l.startsAt.getTime()));

  const slots: SlotOption[] = [];
  const units = unitStarts(open, close, unit);
  for (let i = 0; i + needed <= units.length; i++) {
    const start = units[i];
    if (start.getTime() < earliest) continue;
    const free = units.slice(i, i + needed).every((u) => !taken.has(u.getTime()));
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
  if (activeForPhone > 0) {
    throw new BookingError(
      409,
      "Ya tenés un turno activo con ese teléfono. Podés verlo o cancelarlo desde \"Mi turno\".",
    );
  }

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
        slotLocks: {
          create: unitStarts(startsAt, endsAt, settings.slotDurationMin).map((u) => ({ startsAt: u })),
        },
      },
    });
  } catch (e) {
    // Otra persona reservó el mismo horario en el mismo instante.
    if (isUniqueViolation(e)) throw new BookingError(409, "Ese horario se acaba de ocupar. Elegí otro.");
    throw e;
  }
}

export async function getAppointmentByToken(token: string) {
  await releaseExpired();
  return prisma.appointment.findUnique({ where: { accessToken: token }, include: { service: true } });
}

/** El cliente indica que ya mandó el WhatsApp: el turno deja de vencer y espera al barbero. */
export async function markClientNotified(token: string) {
  await releaseExpired();
  const { count } = await prisma.appointment.updateMany({
    where: {
      accessToken: token,
      status: "PENDIENTE_WHATSAPP",
      clientNotifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { clientNotifiedAt: new Date() },
  });
  if (count === 0) throw new BookingError(409, "El turno ya no está pendiente de confirmación");
}

export function canSelfCancel(appt: { status: string; startsAt: Date }) {
  return (
    ACTIVE_STATUSES.includes(appt.status) &&
    appt.startsAt.getTime() - Date.now() > SELF_CANCEL_MIN_HOURS * 60 * MINUTE
  );
}

async function cancel(id: string, reason: string) {
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id },
      data: { status: "CANCELADO", cancelReason: reason, cancelledAt: new Date() },
    }),
    prisma.slotLock.deleteMany({ where: { appointmentId: id } }),
  ]);
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
  await cancel(appt.id, "CLIENTE");
}

export async function lookupAppointment(code: string, phone: string) {
  await releaseExpired();
  const appt = await prisma.appointment.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { accessToken: true, clientPhone: true },
  });
  // Mismo error si no existe o si el teléfono no coincide, para no revelar códigos válidos.
  if (!appt || appt.clientPhone !== normalizePhone(phone)) {
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
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt || appt.status !== "PENDIENTE_WHATSAPP") throw new BookingError(409, "El turno ya no está pendiente");
  await cancel(id, "RECHAZADO");
}

export async function adminCancel(id: string) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt || !ACTIVE_STATUSES.includes(appt.status)) throw new BookingError(409, "El turno ya está cancelado");
  // TODO(Mercado Pago): permitir reembolso total o del 50% según lo acordado con el cliente.
  await cancel(id, "BARBERO");
}

export async function createBlock(dateKey: string, from: string, to: string, reason?: string) {
  if (!isDateKey(dateKey) || !isTimeKey(from) || !isTimeKey(to)) throw new BookingError(400, "Datos inválidos");
  const settings = await getSettings();
  const unit = settings.slotDurationMin;
  if (minutesOf(from) % unit !== minutesOf(settings.openingTime) % unit || minutesOf(to) % unit !== minutesOf(settings.openingTime) % unit) {
    throw new BookingError(400, `Los horarios tienen que coincidir con la grilla de ${unit} minutos`);
  }
  const startsAt = zonedInstant(dateKey, from);
  const endsAt = zonedInstant(dateKey, to);
  if (endsAt <= startsAt) throw new BookingError(400, "La hora de fin tiene que ser posterior a la de inicio");

  await releaseExpired();
  try {
    await prisma.blockedSlot.create({
      data: {
        startsAt,
        endsAt,
        reason: reason?.trim() || null,
        slotLocks: { create: unitStarts(startsAt, endsAt, unit).map((u) => ({ startsAt: u })) },
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
  await prisma.blockedSlot.delete({ where: { id } });
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
      where: { status: "PENDIENTE_WHATSAPP" },
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
