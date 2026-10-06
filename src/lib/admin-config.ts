import { z } from "zod";
import { prisma, getSettings } from "@/lib/db";
import { ACTIVE_STATUSES, BookingError, releaseExpired } from "@/lib/booking";
import { normalizePhone } from "@/lib/format";
import { dateKeyOf, formatShortDay, formatTime, isTimeKey, minutesOf } from "@/lib/time";

// ---------- Datos del local ----------

export const settingsSchema = z.object({
  salonName: z.string().trim().min(1, "Ingresá el nombre del local").max(80, "El nombre es muy largo"),
  salonAddress: z.string().trim().max(160, "La dirección es muy larga"),
  salonPhone: z.string().trim().min(1, "Ingresá el WhatsApp del barbero"),
  openingTime: z.string().refine(isTimeKey, "Horario de apertura inválido (HH:mm)"),
  closingTime: z.string().refine(isTimeKey, "Horario de cierre inválido (HH:mm)"),
  daysOpen: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Elegí al menos un día de atención"),
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

export async function updateSettings(input: SettingsInput) {
  const phone = normalizePhone(input.salonPhone);
  if (!phone) throw new BookingError(400, "Ingresá un WhatsApp válido con código de área (ej: 11 2345 6789)");

  const unit = input.slotDurationMin;
  const open = minutesOf(input.openingTime);
  const close = minutesOf(input.closingTime);
  if (close <= open) throw new BookingError(400, "El horario de cierre tiene que ser posterior al de apertura");
  if (open % unit !== 0 || close % unit !== 0) {
    throw new BookingError(
      400,
      `Los horarios de apertura y cierre tienen que coincidir con la unidad de agenda de ${unit} minutos`,
    );
  }

  const current = await getSettings();
  const unitChanged = current.slotDurationMin !== unit;
  // La grilla queda definida por la unidad y por la fase de la apertura dentro de ella.
  // Mover la apertura a otro horario de la misma grilla (ej. 09:00 → 10:00 con unidad 30) no la cambia.
  const gridChanged = unitChanged || open % unit !== minutesOf(current.openingTime) % current.slotDurationMin;

  // Los servicios activos tienen que durar un múltiplo de la nueva unidad.
  if (unitChanged) {
    const services = await prisma.service.findMany({ where: { active: true }, select: { name: true, durationMin: true } });
    const misfit = services.filter((s) => s.durationMin % unit !== 0);
    if (misfit.length > 0) {
      throw new BookingError(
        409,
        `No se puede usar una unidad de ${unit} minutos: ${misfit.map((s) => `"${s.name}" (${s.durationMin} min)`).join(", ")} no ${misfit.length === 1 ? "es múltiplo" : "son múltiplos"}. Cambiá esas duraciones o desactivá esos servicios primero.`,
      );
    }
  }

  // Las reservas provisorias vencidas no cuentan como turnos a futuro.
  if (gridChanged) await releaseExpired();

  await prisma.$transaction(async (tx) => {
    // Los SlotLock se guardan con la grilla vigente al reservar. Si cambia la alineación
    // (unidad o fase de la apertura) con turnos o bloqueos a futuro, la base dejaría de
    // impedir superposiciones. Por eso ese cambio solo se permite con la agenda futura vacía.
    if (gridChanged) {
      const now = new Date();
      const [appointments, blockCount] = await Promise.all([
        tx.appointment.findMany({
          where: { status: { in: ACTIVE_STATUSES }, endsAt: { gt: now } },
          select: { code: true, startsAt: true, endsAt: true },
          orderBy: { startsAt: "asc" },
        }),
        tx.blockedSlot.count({ where: { endsAt: { gt: now } } }),
      ]);
      if (appointments.length > 0 || blockCount > 0) {
        const detail: string[] = [];
        if (appointments.length > 0) {
          const list = appointments
            .slice(0, 5)
            .map((a) => `${a.code} (${formatShortDay(dateKeyOf(a.startsAt))} ${formatTime(a.startsAt)})`)
            .join(", ");
          detail.push(`turnos: ${list}${appointments.length > 5 ? ` y ${appointments.length - 5} más` : ""}`);
        }
        if (blockCount > 0) detail.push(`${blockCount} bloqueo${blockCount === 1 ? "" : "s"} de horario`);
        throw new BookingError(
          409,
          `Hay turnos o bloqueos a futuro con la grilla actual; no se puede cambiar la duración de la unidad ni el horario de apertura hasta que pasen o se cancelen (${detail.join("; ")}). El horario de cierre y los días abiertos sí se pueden cambiar.`,
        );
      }
    }

    await tx.businessSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...toSettingsData(input, phone) },
      update: toSettingsData(input, phone),
    });
  });
}

function toSettingsData(input: SettingsInput, phone: string) {
  return {
    salonName: input.salonName,
    salonAddress: input.salonAddress,
    salonPhone: phone,
    openingTime: input.openingTime,
    closingTime: input.closingTime,
    daysOpen: [...new Set(input.daysOpen)].sort((a, b) => a - b).join(","),
    slotDurationMin: input.slotDurationMin,
    bookingWindowDays: input.bookingWindowDays,
    minNoticeMin: input.minNoticeMin,
  };
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
