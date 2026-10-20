import { expect, vi } from "vitest";
import { BookingError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { createAppointment, getAvailability, type CreateAppointmentInput } from "@/lib/booking";
import type { Tenant } from "@/lib/db";
import { zonedInstant } from "@/lib/time";

// Lunes 5/10/2026 a las 08:00 en Argentina (UTC-3). El local abre lunes a sábado de 09 a 20.
export const LUNES = "2026-10-05";
export const MIERCOLES = "2026-10-07";
export const SABADO = "2026-10-10";
export const DOMINGO = "2026-10-11";
export const AHORA = zonedInstant(LUNES, "08:00");
export const MIN = 60_000;

export function setNow(date: Date) {
  vi.setSystemTime(date);
}

export function advance(minutes: number) {
  vi.setSystemTime(new Date(Date.now() + minutes * MIN));
}

/** Borra todo en una sola consulta (la base puede estar lejos: cada ida y vuelta cuesta). */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "SlotLock", "ClientHold", "Appointment", "BlockedSlot", "Session", "StaffUser", "Service",
       "Barber", "Tenant", "Client", "OtpCode", "RateLimit" RESTART IDENTITY CASCADE`,
  );
}

export type Shop = Awaited<ReturnType<typeof makeShop>>;

/** Barbería con dos barberos (Ana y Beto, todo el horario del local) y dos servicios. */
export async function makeShop(slug = "uno") {
  const tenant = await prisma.tenant.create({ data: { slug, name: `Barbería ${slug}`, whatsapp: "5491100000000" } });
  const corte = await prisma.service.create({
    data: { tenantId: tenant.id, name: "Corte", price: 12000, durationMin: 30 },
  });
  const combo = await prisma.service.create({
    data: { tenantId: tenant.id, name: "Combo", price: 17000, durationMin: 60 },
  });
  const ana = await prisma.barber.create({ data: { tenantId: tenant.id, name: "Ana", sortOrder: 0 } });
  const beto = await prisma.barber.create({ data: { tenantId: tenant.id, name: "Beto", sortOrder: 1 } });
  return { tenant, corte: corte.id, combo: combo.id, ana, beto };
}

let n = 0;

export async function makeClient(phone?: string) {
  n++;
  const now = new Date();
  return prisma.client.create({
    data: {
      phone: phone ?? `54911${String(40000000 + n)}`,
      name: `Cliente ${n}`,
      passwordHash: "x",
      phoneVerifiedAt: now,
      acceptedTermsAt: now,
    },
  });
}

/** Reserva con un cliente e IP nuevos en cada llamada, salvo que se indiquen. */
export async function book(
  tenant: Tenant,
  input: Partial<CreateAppointmentInput> & { serviceId: number; barberId: string },
  opts: { client?: { id: string; name: string; phone: string }; ip?: string } = {},
) {
  const client = opts.client ?? (await makeClient());
  return createAppointment(
    tenant,
    client,
    { date: MIERCOLES, time: "10:00", paymentMethod: "EFECTIVO", ...input },
    opts.ip ?? `10.0.0.${++n}`,
  );
}

export async function expectBookingError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BookingError);
  expect((error as BookingError).status).toBe(status);
  return error as BookingError;
}

export async function slotsOf(tenant: Tenant, date: string, serviceId: number, barberId: string) {
  const { slots } = await getAvailability(tenant, date, serviceId, barberId);
  return Object.fromEntries(slots.map((s) => [s.time, s.available]));
}

export async function locksOf(appointmentId: string) {
  return prisma.slotLock.findMany({ where: { appointmentId }, orderBy: { startsAt: "asc" } });
}

export const adminOf = (shop: Shop) => ({ role: "ADMIN", tenantId: shop.tenant.id, barberId: null });
export const barberOf = (shop: Shop, barber: { id: string }) => ({
  role: "BARBER",
  tenantId: shop.tenant.id,
  barberId: barber.id,
});
