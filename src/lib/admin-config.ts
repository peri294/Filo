import { z } from "zod";
import { prisma, type Tenant } from "@/lib/db";
import { setStaffPassword } from "@/lib/auth";
import { LOCK_UNIT_MIN, type StaffScope } from "@/lib/booking";
import { BookingError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { serializeWeeklyHours, WEEK, type WeeklyHours } from "@/lib/schedule";
import { isTimeKey, minutesOf } from "@/lib/time";

// ---------- Horarios ----------

export const dayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.string().refine(isTimeKey, "Horario de apertura inválido (HH:mm)"),
  close: z.string().refine(isTimeKey, "Horario de cierre inválido (HH:mm)"),
});

const dayLabel = (weekday: number) => WEEK.find((d) => d.value === weekday)!.label;

/** Valida los días abiertos (cada uno con su horario) contra la grilla y los pasa al formato guardado. */
function toWeeklyHours(days: z.infer<typeof dayHoursSchema>[], unit: number): WeeklyHours {
  const hours: WeeklyHours = {};
  for (const day of days) {
    const label = dayLabel(day.weekday);
    if (hours[day.weekday]) throw new BookingError(400, `${label} figura dos veces`);
    const open = minutesOf(day.open);
    const close = minutesOf(day.close);
    if (close <= open) throw new BookingError(400, `${label}: el cierre tiene que ser posterior a la apertura`);
    if (open % unit !== 0 || close % unit !== 0) {
      throw new BookingError(400, `${label}: la apertura y el cierre tienen que coincidir con la unidad de agenda de ${unit} minutos`);
    }
    hours[day.weekday] = { open: day.open, close: day.close };
  }
  return hours;
}

// ---------- Datos del local ----------

export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del local").max(80, "El nombre es muy largo"),
  address: z.string().trim().max(160, "La dirección es muy larga"),
  whatsapp: z.string().trim().min(1, "Ingresá el WhatsApp del local"),
  // Solo los días abiertos, cada uno con su horario.
  weeklyHours: z.array(dayHoursSchema).min(1, "Elegí al menos un día de atención").max(7),
  slotDurationMin: z
    .number({ error: "La unidad de agenda tiene que ser un número" })
    .int("La unidad de agenda tiene que ser un número entero")
    .min(5, "La unidad de agenda mínima es de 5 minutos")
    .max(240, "La unidad de agenda máxima es de 240 minutos"),
  bookingWindowDays: z
    .number({ error: "Los días para reservar tienen que ser un número" })
    .int("Los días para reservar tienen que ser un número entero")
    .min(1, "Tiene que poder reservarse al menos 1 día hacia adelante")
    .max(365, "Se puede reservar como máximo 365 días hacia adelante"),
  minNoticeMin: z
    .number({ error: "La anticipación mínima tiene que ser un número" })
    .int("La anticipación mínima tiene que ser un número entero")
    .min(0, "La anticipación mínima no puede ser negativa")
    .max(10_080, "La anticipación mínima puede ser de hasta 7 días (10080 minutos)"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function updateSettings(tenant: Tenant, input: SettingsInput) {
  const whatsapp = normalizePhone(input.whatsapp);
  if (!whatsapp) throw new BookingError(400, "Ingresá un WhatsApp válido con código de área (ej: 11 2345 6789)");

  const unit = input.slotDurationMin;
  // Los turnos se guardan en bloques fijos de 5 minutos (LOCK_UNIT_MIN), así que cambiar la
  // grilla no puede generar superposiciones con turnos ya reservados.
  if (unit % LOCK_UNIT_MIN !== 0) {
    throw new BookingError(400, `La unidad de agenda tiene que ser múltiplo de ${LOCK_UNIT_MIN} minutos`);
  }
  const hours = toWeeklyHours(input.weeklyHours, unit);

  // Los servicios activos tienen que durar un múltiplo de la nueva unidad.
  if (tenant.slotDurationMin !== unit) {
    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { name: true, durationMin: true },
    });
    const misfit = services.filter((s) => s.durationMin % unit !== 0);
    if (misfit.length > 0) {
      throw new BookingError(
        409,
        `No se puede usar una unidad de ${unit} minutos: ${misfit.map((s) => `"${s.name}" (${s.durationMin} min)`).join(", ")} no ${misfit.length === 1 ? "es múltiplo" : "son múltiplos"}. Cambiá esas duraciones o desactivá esos servicios primero.`,
      );
    }
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: input.name,
      address: input.address,
      whatsapp,
      weeklyHours: serializeWeeklyHours(hours),
      slotDurationMin: unit,
      bookingWindowDays: input.bookingWindowDays,
      minNoticeMin: input.minNoticeMin,
    },
  });
}

// ---------- Servicios ----------

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del servicio").max(60, "El nombre es muy largo"),
  description: z.string().trim().max(200, "La descripción es muy larga").optional(),
  price: z
    .number({ error: "El precio tiene que ser un número" })
    .int("El precio va en pesos enteros, sin centavos")
    .min(0, "El precio no puede ser negativo")
    .max(10_000_000, "El precio es demasiado alto"),
  durationMin: z
    .number({ error: "La duración tiene que ser un número" })
    .int("La duración tiene que ser un número entero de minutos")
    .min(1, "La duración tiene que ser mayor a 0")
    .max(600, "La duración máxima es de 600 minutos"),
  sortOrder: z.number({ error: "El orden tiene que ser un número" }).int("El orden tiene que ser un número entero").min(0).max(999),
  active: z.boolean().optional(),
});

export const servicePatchSchema = serviceSchema.partial();

export type ServiceInput = z.infer<typeof serviceSchema>;

function assertDuration(tenant: Tenant, durationMin: number) {
  if (durationMin % tenant.slotDurationMin !== 0) {
    throw new BookingError(400, `La duración tiene que ser múltiplo de la unidad de agenda (${tenant.slotDurationMin} minutos)`);
  }
}

async function findService(tenant: Tenant, id: number) {
  const service = await prisma.service.findFirst({
    where: { id, tenantId: tenant.id },
    include: { _count: { select: { appointments: true } } },
  });
  if (!service) throw new BookingError(404, "Servicio no encontrado");
  return service;
}

export async function listServicesForAdmin(tenant: Tenant) {
  return prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { appointments: true } } },
  });
}

export async function createService(tenant: Tenant, input: ServiceInput) {
  assertDuration(tenant, input.durationMin);
  return prisma.service.create({
    data: {
      tenantId: tenant.id,
      name: input.name,
      description: input.description || null,
      price: input.price,
      durationMin: input.durationMin,
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    },
  });
}

export async function updateService(tenant: Tenant, id: number, input: Partial<ServiceInput>) {
  const service = await findService(tenant, id);
  const durationMin = input.durationMin ?? service.durationMin;
  const active = input.active ?? service.active;
  // Un servicio activo siempre tiene que encajar en la grilla (también al reactivarlo).
  if (active && (input.durationMin !== undefined || (input.active && !service.active))) {
    assertDuration(tenant, durationMin);
  }
  return prisma.service.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
      price: input.price,
      durationMin: input.durationMin,
      sortOrder: input.sortOrder,
      active: input.active,
    },
  });
}

/** Solo se borran servicios sin turnos; los que tienen turnos se desactivan. */
export async function deleteService(tenant: Tenant, id: number) {
  const service = await findService(tenant, id);
  if (service._count.appointments > 0) {
    throw new BookingError(409, "Este servicio tiene turnos registrados: no se puede borrar, solo desactivar");
  }
  await prisma.service.delete({ where: { id } });
}

// ---------- Barberos ----------

const loginSchema = z.object({ phone: z.string().trim().min(1), password: z.string() });

export const barberSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del barbero").max(60, "El nombre es muy largo"),
  // null = trabaja todo el horario del local.
  weeklyHours: z.array(dayHoursSchema).max(7).nullable(),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean().optional(),
  // Usuario para que el barbero entre al panel (opcional).
  login: loginSchema.optional(),
  // El admin que lo crea también atiende: el barbero es él.
  isMe: z.boolean().optional(),
});

export const barberPatchSchema = barberSchema.omit({ login: true, isMe: true }).partial();

export type BarberInput = z.infer<typeof barberSchema>;

function barberHoursValue(tenant: Tenant, days: BarberInput["weeklyHours"]) {
  if (days === null) return null;
  return serializeWeeklyHours(toWeeklyHours(days, tenant.slotDurationMin));
}

async function findBarber(tenant: Tenant, id: string) {
  const barber = await prisma.barber.findFirst({ where: { id, tenantId: tenant.id }, include: { user: true } });
  if (!barber) throw new BookingError(404, "Barbero no encontrado");
  return barber;
}

export async function listBarbersForAdmin(tenant: Tenant) {
  return prisma.barber.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, phone: true, role: true, active: true } },
      _count: { select: { appointments: true } },
    },
  });
}

async function newStaffLogin(login: z.infer<typeof loginSchema>) {
  const phone = normalizePhone(login.phone);
  if (!phone) throw new BookingError(400, "Ingresá un celular válido con código de área para el usuario");
  const problem = passwordProblem(login.password);
  if (problem) throw new BookingError(400, problem);
  if (await prisma.staffUser.findUnique({ where: { phone } })) {
    throw new BookingError(409, "Ese celular ya tiene un usuario del panel");
  }
  return { phone, passwordHash: await hashPassword(login.password) };
}

export async function createBarber(tenant: Tenant, admin: { id: string; barberId: string | null }, input: BarberInput) {
  const weeklyHours = barberHoursValue(tenant, input.weeklyHours);
  if (input.isMe && admin.barberId) throw new BookingError(409, "Ya figurás como barbero");
  if (input.isMe && input.login) throw new BookingError(400, "Si el barbero sos vos, usás tu propio usuario");
  const login = input.login ? await newStaffLogin(input.login) : null;

  return prisma.$transaction(async (tx) => {
    const barber = await tx.barber.create({
      data: { tenantId: tenant.id, name: input.name, weeklyHours, sortOrder: input.sortOrder, active: input.active ?? true },
    });
    if (input.isMe) {
      await tx.staffUser.update({ where: { id: admin.id }, data: { barberId: barber.id } });
    } else if (login) {
      await tx.staffUser.create({
        data: { ...login, name: input.name, role: "BARBER", tenantId: tenant.id, barberId: barber.id },
      });
    }
    return barber;
  });
}

export async function updateBarber(tenant: Tenant, id: string, input: z.infer<typeof barberPatchSchema>) {
  const barber = await findBarber(tenant, id);
  const data = {
    name: input.name,
    sortOrder: input.sortOrder,
    active: input.active,
    weeklyHours: input.weeklyHours === undefined ? undefined : barberHoursValue(tenant, input.weeklyHours),
  };
  await prisma.$transaction(async (tx) => {
    await tx.barber.update({ where: { id }, data });
    // Un barbero dado de baja no puede entrar al panel (salvo que sea el admin).
    if (input.active !== undefined && barber.user && barber.user.role === "BARBER") {
      await tx.staffUser.update({ where: { id: barber.user.id }, data: { active: input.active } });
      if (!input.active) await tx.session.deleteMany({ where: { staffUserId: barber.user.id } });
    }
  });
}

/** Crea el usuario de un barbero que no tenía, o le asigna una clave nueva (plan B si no puede recuperarla). */
export async function setBarberLogin(tenant: Tenant, id: string, login: z.infer<typeof loginSchema>) {
  const barber = await findBarber(tenant, id);
  if (barber.user) {
    if (barber.user.role !== "BARBER") throw new BookingError(403, "La clave del admin se cambia desde su propia cuenta");
    await setStaffPassword(barber.user.id, login.password);
    return;
  }
  const data = await newStaffLogin(login);
  await prisma.staffUser.create({
    data: { ...data, name: barber.name, role: "BARBER", tenantId: tenant.id, barberId: barber.id, active: barber.active },
  });
}

/** Solo se borran barberos sin turnos; los demás se desactivan. */
export async function deleteBarber(tenant: Tenant, staff: StaffScope, id: string) {
  const barber = await findBarber(tenant, id);
  if (staff.barberId === id) throw new BookingError(409, "No podés borrarte a vos mismo");
  const count = await prisma.appointment.count({ where: { barberId: id } });
  if (count > 0) throw new BookingError(409, "Este barbero tiene turnos registrados: no se puede borrar, solo desactivar");
  await prisma.$transaction([
    ...(barber.user ? [prisma.staffUser.delete({ where: { id: barber.user.id } })] : []),
    prisma.barber.delete({ where: { id } }),
  ]);
}
