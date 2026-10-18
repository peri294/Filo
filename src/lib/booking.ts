import { randomBytes, randomInt } from "node:crypto";
import { Prisma, type Barber } from "@/generated/prisma/client";
import { prisma, type Tenant } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { parseWeeklyHours, type DayHours } from "@/lib/schedule";
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

export { BookingError };

export const ACTIVE_STATUSES = ["PENDIENTE_WHATSAPP", "PENDIENTE_PAGO", "CONFIRMADO"];
const PENDING_STATUSES = ["PENDIENTE_WHATSAPP", "PENDIENTE_PAGO"];

export const CASH_HOLD_MIN = 15;
/** Cuánto más se retiene el horario después de que el cliente avisa que mandó el WhatsApp. */
export const NOTIFIED_HOLD_HOURS = 12;
export const SELF_CANCEL_MIN_HOURS = 24;
/** Tamaño fijo de cada SlotLock. No depende de la grilla configurada, así cambiarla no rompe nada. */
export const LOCK_UNIT_MIN = 5;
const MAX_BOOKINGS_PER_IP_PER_HOUR = 3;
/** Valor de "El primero disponible" en lugar de un id de barbero. */
export const ANY_BARBER = "any";

const MINUTE = 60_000;

/** Lo mínimo del personal logueado que hace falta para chequear permisos sobre la agenda. */
export type StaffScope = { role: string; tenantId: string | null; barberId: string | null };

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

type Tx = Prisma.TransactionClient;

/** Libera los horarios y el "un turno activo por cliente" de turnos cancelados. */
async function releaseHolds(tx: Tx, where: Prisma.AppointmentWhereInput) {
  await tx.slotLock.deleteMany({ where: { appointment: where } });
  await tx.clientHold.deleteMany({ where: { appointment: where } });
}

/**
 * Cancela las reservas provisorias vencidas (de todas las barberías) y libera sus horarios.
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

function lockRows(barberId: string, start: Date, end: Date) {
  return unitStarts(start, end, LOCK_UNIT_MIN).map((u) => ({ barberId, startsAt: u }));
}

function durationMsFor(durationMin: number, tenant: Tenant) {
  return Math.max(1, Math.ceil(durationMin / tenant.slotDurationMin)) * tenant.slotDurationMin * MINUTE;
}

/** Horario de un barbero en una fecha: su horario propio recortado al del local. */
export function barberHours(tenant: Tenant, barber: Pick<Barber, "weeklyHours">, dateKey: string): DayHours | null {
  const weekday = weekdayOf(dateKey);
  const local = parseWeeklyHours(tenant.weeklyHours)[weekday];
  if (!local) return null;
  if (!barber.weeklyHours) return local;
  const own = parseWeeklyHours(barber.weeklyHours)[weekday];
  if (!own) return null;
  const open = minutesOf(own.open) > minutesOf(local.open) ? own.open : local.open;
  const close = minutesOf(own.close) < minutesOf(local.close) ? own.close : local.close;
  return minutesOf(close) > minutesOf(open) ? { open, close } : null;
}

/** Días que se pueden reservar (el local abre), desde hoy hasta el límite configurado. */
export function bookableDates(tenant: Tenant) {
  const hours = parseWeeklyHours(tenant.weeklyHours);
  const today = todayKey();
  const dates: string[] = [];
  for (let i = 0; i <= tenant.bookingWindowDays; i++) {
    const key = addDaysToKey(today, i);
    if (hours[weekdayOf(key)]) dates.push(key);
  }
  return dates;
}

export function activeBarbers(tenantId: string) {
  return prisma.barber.findMany({
    where: { tenantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export type SlotOption = { time: string; available: boolean };

/** Para cada barbero, los inicios posibles del día y si están libres. */
async function slotsByBarber(tenant: Tenant, dateKey: string, durationMs: number, barbers: Barber[]) {
  const dayStart = zonedInstant(dateKey, "00:00");
  const dayEnd = zonedInstant(addDaysToKey(dateKey, 1), "00:00");
  const locks = await prisma.slotLock.findMany({
    where: { barberId: { in: barbers.map((b) => b.id) }, startsAt: { gte: dayStart, lt: dayEnd } },
    select: { barberId: true, startsAt: true },
  });
  const taken = new Set(locks.map((l) => `${l.barberId}|${l.startsAt.getTime()}`));
  const earliest = Date.now() + tenant.minNoticeMin * MINUTE;

  const result = new Map<string, Map<string, boolean>>();
  for (const barber of barbers) {
    const hours = barberHours(tenant, barber, dateKey);
    const slots = new Map<string, boolean>();
    result.set(barber.id, slots);
    if (!hours) continue;
    const open = zonedInstant(dateKey, hours.open);
    const close = zonedInstant(dateKey, hours.close);
    for (const start of unitStarts(open, close, tenant.slotDurationMin)) {
      const end = new Date(start.getTime() + durationMs);
      if (end > close) break;
      if (start.getTime() < earliest) continue;
      const free = unitStarts(start, end, LOCK_UNIT_MIN).every((u) => !taken.has(`${barber.id}|${u.getTime()}`));
      slots.set(formatTime(start), free);
    }
  }
  return result;
}

async function findService(tenant: Tenant, serviceId: number) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, tenantId: tenant.id, active: true } });
  if (!service) throw new BookingError(404, "Servicio no encontrado");
  return service;
}

/** Barberos entre los que se busca: uno elegido o todos los activos ("El primero disponible"). */
async function candidateBarbers(tenant: Tenant, barberChoice: string) {
  const barbers = await activeBarbers(tenant.id);
  if (barberChoice === ANY_BARBER) return barbers;
  const barber = barbers.find((b) => b.id === barberChoice);
  if (!barber) throw new BookingError(404, "Ese barbero no está disponible");
  return [barber];
}

export async function getAvailability(tenant: Tenant, dateKey: string, serviceId: number, barberChoice: string) {
  if (!isDateKey(dateKey)) throw new BookingError(400, "Fecha inválida");
  const service = await findService(tenant, serviceId);
  const barbers = await candidateBarbers(tenant, barberChoice);
  if (!bookableDates(tenant).includes(dateKey)) return { dateKey, open: false, slots: [] as SlotOption[] };

  await releaseExpired();
  const byBarber = await slotsByBarber(tenant, dateKey, durationMsFor(service.durationMin, tenant), barbers);

  // Un horario está libre si al menos uno de los barberos considerados lo tiene libre.
  const merged = new Map<string, boolean>();
  for (const slots of byBarber.values()) {
    for (const [time, free] of slots) merged.set(time, (merged.get(time) ?? false) || free);
  }
  const slots = [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([time, available]) => ({ time, available }));
  return { dateKey, open: slots.length > 0, slots };
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return `TURN-${code}`;
}

const CLIENT_TAKEN = new BookingError(
  409,
  'Ya tenés un turno activo en esta barbería. Podés verlo o cancelarlo desde "Mis turnos".',
);

export type CreateAppointmentInput = {
  serviceId: number;
  date: string;
  time: string;
  barberId: string; // id del barbero o ANY_BARBER
  paymentMethod: "EFECTIVO" | "MERCADOPAGO";
};

export type BookingClient = { id: string; name: string; phone: string };

export async function createAppointment(
  tenant: Tenant,
  client: BookingClient,
  input: CreateAppointmentInput,
  clientIp: string,
) {
  if (!tenant.active) throw new BookingError(403, "Esta barbería no está tomando turnos online por el momento");
  if (input.paymentMethod === "MERCADOPAGO") {
    throw new BookingError(400, "El pago con Mercado Pago todavía no está disponible");
  }
  if (!isDateKey(input.date) || !isTimeKey(input.time)) throw new BookingError(400, "Fecha u hora inválida");

  const now = new Date();
  await releaseExpired();

  // Un solo turno activo por cliente en cada barbería.
  const active = await prisma.appointment.count({
    where: { tenantId: tenant.id, clientId: client.id, status: { in: ACTIVE_STATUSES }, endsAt: { gt: now } },
  });
  if (active > 0) throw CLIENT_TAKEN;

  // Límite de reservas por IP (la IP se comparte en redes móviles, por eso no es 1).
  const recentFromIp = await prisma.appointment.count({
    where: { clientIp, createdAt: { gt: new Date(now.getTime() - 60 * MINUTE) } },
  });
  if (recentFromIp >= MAX_BOOKINGS_PER_IP_PER_HOUR) {
    throw new BookingError(429, "Demasiadas reservas desde tu conexión. Probá de nuevo más tarde.");
  }

  const service = await findService(tenant, input.serviceId);
  const barbers = await candidateBarbers(tenant, input.barberId);
  if (!bookableDates(tenant).includes(input.date)) throw new BookingError(400, "Ese día no se puede reservar");
  const durationMs = durationMsFor(service.durationMin, tenant);
  const byBarber = await slotsByBarber(tenant, input.date, durationMs, barbers);

  const offered = barbers.filter((b) => byBarber.get(b.id)?.has(input.time));
  if (offered.length === 0) throw new BookingError(400, "Ese horario no está disponible para reservar");
  let free = offered.filter((b) => byBarber.get(b.id)?.get(input.time));
  if (free.length === 0) throw new BookingError(409, "Ese horario ya está ocupado. Elegí otro.");

  // "El primero disponible": primero el que tiene menos turnos ese día, para repartir el trabajo.
  if (free.length > 1) {
    const dayStart = zonedInstant(input.date, "00:00");
    const dayEnd = zonedInstant(addDaysToKey(input.date, 1), "00:00");
    const counts = await prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        barberId: { in: free.map((b) => b.id) },
        status: { in: ACTIVE_STATUSES },
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      _count: true,
    });
    const load = new Map(counts.map((c) => [c.barberId, c._count]));
    free = [...free].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0));
  }

  const startsAt = zonedInstant(input.date, input.time);
  const endsAt = new Date(startsAt.getTime() + durationMs);

  // Si el turno anterior de este cliente en esta barbería ya pasó, su ClientHold quedó: se libera acá.
  await prisma.clientHold.deleteMany({
    where: {
      tenantId: tenant.id,
      clientId: client.id,
      appointment: { OR: [{ status: "CANCELADO" }, { endsAt: { lte: now } }] },
    },
  });

  for (const barber of free) {
    try {
      return await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          barberId: barber.id,
          clientId: client.id,
          code: generateCode(),
          accessToken: randomBytes(24).toString("base64url"),
          startsAt,
          endsAt,
          clientName: client.name,
          clientPhone: client.phone,
          clientIp,
          serviceId: service.id,
          price: service.price,
          paymentMethod: input.paymentMethod,
          status: "PENDIENTE_WHATSAPP",
          expiresAt: new Date(now.getTime() + CASH_HOLD_MIN * MINUTE),
          slotLocks: { create: lockRows(barber.id, startsAt, endsAt) },
          clientHold: { create: { tenantId: tenant.id, clientId: client.id } },
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Chocó con otra reserva simultánea: si fue el mismo cliente, se corta; si fue el horario, se prueba otro barbero.
      if (
        await prisma.clientHold.findUnique({
          where: { tenantId_clientId: { tenantId: tenant.id, clientId: client.id } },
        })
      ) {
        throw CLIENT_TAKEN;
      }
    }
  }
  throw new BookingError(409, "Ese horario se acaba de ocupar. Elegí otro.");
}

export async function getAppointmentByToken(token: string) {
  await releaseExpired();
  return prisma.appointment.findUnique({
    where: { accessToken: token },
    include: { service: true, barber: true, tenant: true },
  });
}

/**
 * El cliente indica que ya mandó el WhatsApp. Como no se puede comprobar, no anula el
 * vencimiento: lo extiende NOTIFIED_HOLD_HOURS (sin pasar el inicio del turno) para darle
 * tiempo a la barbería a confirmar.
 */
export async function markClientNotified(clientId: string, token: string) {
  await releaseExpired();
  const now = new Date();
  const appt = await prisma.appointment.findUnique({
    where: { accessToken: token },
    select: { startsAt: true, clientId: true },
  });
  if (!appt || appt.clientId !== clientId) throw new BookingError(404, "Turno no encontrado");
  const holdUntil = Math.min(now.getTime() + NOTIFIED_HOLD_HOURS * 60 * MINUTE, appt.startsAt.getTime());
  const { count } = await prisma.appointment.updateMany({
    where: { accessToken: token, status: "PENDIENTE_WHATSAPP", clientNotifiedAt: null, expiresAt: { gt: now } },
    data: { clientNotifiedAt: now, expiresAt: new Date(Math.max(holdUntil, now.getTime() + CASH_HOLD_MIN * MINUTE)) },
  });
  if (count === 0) throw new BookingError(409, "El turno ya no está pendiente de confirmación");
}

export function canSelfCancel(appt: { status: string; startsAt: Date }) {
  return (
    ACTIVE_STATUSES.includes(appt.status) && appt.startsAt.getTime() - Date.now() > SELF_CANCEL_MIN_HOURS * 60 * MINUTE
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

export async function cancelByClient(clientId: string, token: string) {
  const appt = await getAppointmentByToken(token);
  if (!appt || appt.clientId !== clientId) throw new BookingError(404, "Turno no encontrado");
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

/** "Mis turnos": los del cliente en todas las barberías, los próximos primero. */
export async function listClientAppointments(clientId: string) {
  await releaseExpired();
  const all = await prisma.appointment.findMany({
    where: { clientId },
    include: { service: true, barber: true, tenant: true },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  const now = Date.now();
  const upcoming = all.filter((a) => a.endsAt.getTime() > now && ACTIVE_STATUSES.includes(a.status)).reverse();
  const past = all.filter((a) => !upcoming.includes(a));
  return { upcoming, past };
}

// ---------- Panel de la barbería ----------

/**
 * Turno que el usuario puede gestionar: el admin, cualquiera de su barbería; el barbero, solo los suyos.
 * Si no existe o es de otra barbería u otro barbero, responde 404 (no revela que existe).
 */
async function findManaged(staff: StaffScope, id: string) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt || !canManage(staff, appt)) throw new BookingError(404, "Turno no encontrado");
  return appt;
}

export function canManage(staff: StaffScope, target: { tenantId: string; barberId: string }) {
  if (staff.role === "ADMIN") return target.tenantId === staff.tenantId;
  if (staff.role === "BARBER") return target.tenantId === staff.tenantId && target.barberId === staff.barberId;
  return false;
}

export async function adminConfirm(staff: StaffScope, id: string) {
  await releaseExpired();
  await findManaged(staff, id);
  const { count } = await prisma.appointment.updateMany({
    where: { id, status: "PENDIENTE_WHATSAPP" },
    data: { status: "CONFIRMADO", confirmedAt: new Date(), expiresAt: null },
  });
  if (count === 0) throw new BookingError(409, "El turno ya no está pendiente (puede haber vencido)");
}

export async function adminReject(staff: StaffScope, id: string) {
  await releaseExpired();
  await findManaged(staff, id);
  if (!(await cancel(id, "RECHAZADO", ["PENDIENTE_WHATSAPP"])))
    throw new BookingError(409, "El turno ya no está pendiente");
}

export async function adminCancel(staff: StaffScope, id: string) {
  await releaseExpired();
  await findManaged(staff, id);
  // TODO(Mercado Pago): si el turno está pago, ofrecer el reembolso total.
  if (!(await cancel(id, "BARBERO", ACTIVE_STATUSES))) throw new BookingError(409, "El turno ya está cancelado");
}

export type Attendance = "ASISTIO" | "NO_VINO" | null;

/** Si el turno ya empezó (desde ahí se puede marcar la asistencia). */
export function hasStarted(appt: { startsAt: Date }) {
  return appt.startsAt.getTime() <= Date.now();
}

/** Marca si el cliente vino. Solo para turnos confirmados que ya empezaron. */
export async function markAttendance(staff: StaffScope, id: string, attendance: Attendance) {
  const appt = await findManaged(staff, id);
  if (appt.status !== "CONFIRMADO") throw new BookingError(409, "Solo se marca la asistencia de turnos confirmados");
  if (!hasStarted(appt)) throw new BookingError(409, "El turno todavía no empezó");
  await prisma.appointment.update({ where: { id }, data: { attendance } });
}

export type BlockInput = { barberId: string; date: string; from: string; to: string; reason?: string };

/** Bloquea un horario de un barbero, o de todos (barberId = ANY_BARBER, solo el admin). */
export async function createBlock(staff: StaffScope, tenant: Tenant, input: BlockInput) {
  const { date, from, to } = input;
  if (!isDateKey(date) || !isTimeKey(from) || !isTimeKey(to)) throw new BookingError(400, "Datos inválidos");

  let barbers = await activeBarbers(tenant.id);
  if (input.barberId === ANY_BARBER) {
    if (staff.role !== "ADMIN") throw new BookingError(403, "Solo el admin puede bloquear a todos los barberos");
  } else {
    barbers = barbers.filter(
      (b) => b.id === input.barberId && canManage(staff, { tenantId: b.tenantId, barberId: b.id }),
    );
    if (barbers.length === 0) throw new BookingError(404, "Barbero no encontrado");
  }

  const local = parseWeeklyHours(tenant.weeklyHours)[weekdayOf(date)];
  if (!local) throw new BookingError(400, "Ese día el local está cerrado");
  const hours = input.barberId === ANY_BARBER ? local : barberHours(tenant, barbers[0], date);
  if (!hours) throw new BookingError(400, "Ese día el barbero no trabaja");

  const unit = tenant.slotDurationMin;
  const phase = minutesOf(hours.open) % unit;
  if (minutesOf(from) % unit !== phase || minutesOf(to) % unit !== phase) {
    throw new BookingError(400, `Los horarios tienen que coincidir con la grilla de ${unit} minutos`);
  }
  const startsAt = zonedInstant(date, from);
  const endsAt = zonedInstant(date, to);
  if (endsAt <= startsAt) throw new BookingError(400, "La hora de fin tiene que ser posterior a la de inicio");
  if (minutesOf(from) < minutesOf(hours.open) || minutesOf(to) > minutesOf(hours.close)) {
    throw new BookingError(
      400,
      `El bloqueo tiene que estar dentro del horario de atención (${hours.open} a ${hours.close})`,
    );
  }

  await releaseExpired();
  try {
    // Todos o ninguno: si un barbero tiene un turno en ese rango, no se bloquea a nadie.
    await prisma.$transaction(async (tx) => {
      for (const barber of barbers) {
        await tx.blockedSlot.create({
          data: {
            tenantId: tenant.id,
            barberId: barber.id,
            startsAt,
            endsAt,
            reason: input.reason?.trim() || null,
            slotLocks: { create: lockRows(barber.id, startsAt, endsAt) },
          },
        });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new BookingError(409, "Hay turnos o bloqueos en ese rango. Cancelalos primero o elegí otro horario.");
    }
    throw e;
  }
}

export async function deleteBlock(staff: StaffScope, id: string) {
  const block = await prisma.blockedSlot.findUnique({ where: { id } });
  if (!block || !canManage(staff, block)) throw new BookingError(404, "El bloqueo no existe");
  await prisma.blockedSlot.deleteMany({ where: { id } });
}

/** Lunes de la semana de la fecha dada. */
export function weekStartOf(dateKey: string) {
  return addDaysToKey(dateKey, -((weekdayOf(dateKey) + 6) % 7));
}

/**
 * Agenda del panel. El admin ve a todos (o filtra por barbero); el barbero, solo la suya.
 */
export async function getAgenda(staff: StaffScope, tenant: Tenant, dateKey: string, barberFilter?: string) {
  if (staff.role !== "ADMIN" && staff.role !== "BARBER")
    throw new BookingError(403, "No tenés permiso para ver la agenda");
  await releaseExpired();
  const barberId = staff.role === "BARBER" ? (staff.barberId ?? "ninguno") : barberFilter || undefined;
  const scope = { tenantId: tenant.id, ...(barberId ? { barberId } : {}) };

  const dayStart = zonedInstant(dateKey, "00:00");
  const dayEnd = zonedInstant(addDaysToKey(dateKey, 1), "00:00");
  const weekStart = zonedInstant(weekStartOf(dateKey), "00:00");
  const weekEnd = zonedInstant(addDaysToKey(weekStartOf(dateKey), 7), "00:00");

  const [barbers, appointments, blocks, pending, week] = await Promise.all([
    prisma.barber.findMany({ where: { tenantId: tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.appointment.findMany({
      where: { ...scope, startsAt: { gte: dayStart, lt: dayEnd } },
      include: { service: true, barber: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.blockedSlot.findMany({
      where: { ...scope, startsAt: { gte: dayStart, lt: dayEnd } },
      include: { barber: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { ...scope, status: "PENDIENTE_WHATSAPP", endsAt: { gt: new Date() } },
      include: { service: true, barber: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { ...scope, startsAt: { gte: weekStart, lt: weekEnd }, status: { in: ACTIVE_STATUSES } },
      select: { startsAt: true },
    }),
  ]);

  return { barbers, appointments, blocks, pending, week, barberId: barberId ?? null };
}
