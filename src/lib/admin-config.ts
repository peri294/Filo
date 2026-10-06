import { z } from "zod";
import { prisma, getSettings } from "@/lib/db";
import { BookingError, LOCK_UNIT_MIN } from "@/lib/booking";
import { normalizePhone } from "@/lib/format";
import { serializeWeeklyHours, WEEK, type WeeklyHours } from "@/lib/schedule";
import { isTimeKey, minutesOf } from "@/lib/time";

// ---------- Datos del local ----------

const dayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.string().refine(isTimeKey, "Horario de apertura inválido (HH:mm)"),
  close: z.string().refine(isTimeKey, "Horario de cierre inválido (HH:mm)"),
});

export const settingsSchema = z.object({
  salonName: z.string().trim().min(1, "Ingresá el nombre del local").max(80, "El nombre es muy largo"),
  salonAddress: z.string().trim().max(160, "La dirección es muy larga"),
  salonPhone: z.string().trim().min(1, "Ingresá el WhatsApp del barbero"),
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

const dayLabel = (weekday: number) => WEEK.find((d) => d.value === weekday)!.label;

export async function updateSettings(input: SettingsInput) {
  const phone = normalizePhone(input.salonPhone);
  if (!phone) throw new BookingError(400, "Ingresá un WhatsApp válido con código de área (ej: 11 2345 6789)");

  const unit = input.slotDurationMin;
  // Los turnos se guardan en bloques fijos de 5 minutos (LOCK_UNIT_MIN), así que cambiar la
  // grilla no puede generar superposiciones con turnos ya reservados.
  if (unit % LOCK_UNIT_MIN !== 0) {
    throw new BookingError(400, `La unidad de agenda tiene que ser múltiplo de ${LOCK_UNIT_MIN} minutos`);
  }

  const hours: WeeklyHours = {};
  for (const day of input.weeklyHours) {
    const label = dayLabel(day.weekday);
    if (hours[day.weekday]) throw new BookingError(400, `${label} figura dos veces`);
    const open = minutesOf(day.open);
    const close = minutesOf(day.close);
    if (close <= open) throw new BookingError(400, `${label}: el cierre tiene que ser posterior a la apertura`);
    if (open % unit !== 0 || close % unit !== 0) {
      throw new BookingError(
        400,
        `${label}: la apertura y el cierre tienen que coincidir con la unidad de agenda de ${unit} minutos`,
      );
    }
    hours[day.weekday] = { open: day.open, close: day.close };
  }

  const current = await getSettings();
  // Los servicios activos tienen que durar un múltiplo de la nueva unidad.
  if (current.slotDurationMin !== unit) {
    const services = await prisma.service.findMany({ where: { active: true }, select: { name: true, durationMin: true } });
    const misfit = services.filter((s) => s.durationMin % unit !== 0);
    if (misfit.length > 0) {
      throw new BookingError(
        409,
        `No se puede usar una unidad de ${unit} minutos: ${misfit.map((s) => `"${s.name}" (${s.durationMin} min)`).join(", ")} no ${misfit.length === 1 ? "es múltiplo" : "son múltiplos"}. Cambiá esas duraciones o desactivá esos servicios primero.`,
      );
    }
  }

  const data = {
    salonName: input.salonName,
    salonAddress: input.salonAddress,
    salonPhone: phone,
    weeklyHours: serializeWeeklyHours(hours),
    slotDurationMin: unit,
    bookingWindowDays: input.bookingWindowDays,
    minNoticeMin: input.minNoticeMin,
  };
  await prisma.businessSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
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

async function assertDuration(durationMin: number) {
  const { slotDurationMin: unit } = await getSettings();
  if (durationMin % unit !== 0) {
    throw new BookingError(400, `La duración tiene que ser múltiplo de la unidad de agenda (${unit} minutos)`);
  }
}

export async function listServicesForAdmin() {
  return prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { appointments: true } } },
  });
}

export async function createService(input: ServiceInput) {
  await assertDuration(input.durationMin);
  return prisma.service.create({
    data: {
      name: input.name,
      description: input.description || null,
      price: input.price,
      durationMin: input.durationMin,
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    },
  });
}

export async function updateService(id: number, input: Partial<ServiceInput>) {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new BookingError(404, "Servicio no encontrado");

  const durationMin = input.durationMin ?? service.durationMin;
  const active = input.active ?? service.active;
  // Un servicio activo siempre tiene que encajar en la grilla (también al reactivarlo).
  if (active && (input.durationMin !== undefined || (input.active && !service.active))) {
    await assertDuration(durationMin);
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
export async function deleteService(id: number) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { _count: { select: { appointments: true } } },
  });
  if (!service) throw new BookingError(404, "Servicio no encontrado");
  if (service._count.appointments > 0) {
    throw new BookingError(409, "Este servicio tiene turnos registrados: no se puede borrar, solo desactivar");
  }
  await prisma.service.delete({ where: { id } });
}
