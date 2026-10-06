import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminCancel,
  adminConfirm,
  adminReject,
  bookableDates,
  BookingError,
  cancelByClient,
  createAppointment,
  createBlock,
  deleteBlock,
  getAppointmentByToken,
  getAvailability,
  LOCK_UNIT_MIN,
  lookupAppointment,
  markClientNotified,
  releaseExpired,
  type CreateAppointmentInput,
} from "@/lib/booking";
import { getSettings, prisma } from "@/lib/db";
import { updateSettings } from "@/lib/admin-config";
import { describeWeek } from "@/lib/schedule";
import { isDateKey, zonedInstant } from "@/lib/time";

// Lunes 5/10/2026 a las 08:00 en Argentina (UTC-3). La barbería abre lunes a sábado de 09 a 20.
const LUNES = "2026-10-05";
const MIERCOLES = "2026-10-07";
const DOMINGO = "2026-10-11";
const AHORA = zonedInstant(LUNES, "08:00");
const MIN = 60_000;

let corte: number; // 30 min = 1 unidad de agenda
let combo: number; // 60 min = 2 unidades de agenda
const LOCKS_COMBO = 60 / LOCK_UNIT_MIN; // SlotLock de 5 minutos que ocupa un combo
const LUNES_A_SABADO = [1, 2, 3, 4, 5, 6];
let n = 0;

function setNow(date: Date) {
  vi.setSystemTime(date);
}

function advance(minutes: number) {
  vi.setSystemTime(new Date(Date.now() + minutes * MIN));
}

/** Reserva con teléfono e IP distintos en cada llamada, salvo que se indiquen. */
function book(input: Partial<CreateAppointmentInput> = {}, ip?: string) {
  n++;
  return createAppointment(
    {
      serviceId: combo,
      date: MIERCOLES,
      time: "10:00",
      clientName: `Cliente ${n}`,
      clientPhone: `11 ${String(40000000 + n).slice(0, 4)}-${String(40000000 + n).slice(4)}`,
      paymentMethod: "EFECTIVO",
      ...input,
    },
    ip ?? `10.0.0.${n}`,
  );
}

async function expectBookingError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BookingError);
  expect((error as BookingError).status).toBe(status);
  return error as BookingError;
}

async function slotsOf(date: string, serviceId: number) {
  const { slots } = await getAvailability(date, serviceId);
  return Object.fromEntries(slots.map((s) => [s.time, s.available]));
}

async function locksOf(appointmentId: string) {
  return prisma.slotLock.findMany({ where: { appointmentId }, orderBy: { startsAt: "asc" } });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(AHORA);
  await prisma.slotLock.deleteMany();
  await prisma.phoneHold.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.service.deleteMany();
  await prisma.businessSetting.deleteMany();
  await getSettings(); // valores por defecto: 09–20, unidad de 30 min, lunes a sábado
  corte = (await prisma.service.create({ data: { name: "Corte", price: 12000, durationMin: 30 } })).id;
  combo = (await prisma.service.create({ data: { name: "Corte + Barba", price: 17000, durationMin: 60 } })).id;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("días y disponibilidad", () => {
  it("solo se puede reservar de lunes a sábado", async () => {
    const dates = bookableDates(await getSettings());
    expect(dates[0]).toBe(LUNES);
    expect(dates).toContain(MIERCOLES);
    expect(dates).not.toContain(DOMINGO);
    expect(await getAvailability(DOMINGO, corte)).toEqual({ dateKey: DOMINGO, open: false, slots: [] });
  });

  it("un servicio de 60 min ofrece inicios hasta una hora antes del cierre", async () => {
    const { slots, open } = await getAvailability(MIERCOLES, combo);
    expect(open).toBe(true);
    expect(slots[0]).toEqual({ time: "09:00", available: true });
    expect(slots.at(-1)).toEqual({ time: "19:00", available: true });
    expect(slots).toHaveLength(21);
    expect((await getAvailability(MIERCOLES, corte)).slots.at(-1)?.time).toBe("19:30");
  });

  it("un turno de 60 min ocupa 2 unidades y bloquea los inicios que se superponen", async () => {
    const appt = await book({ serviceId: combo, time: "10:00" });
    expect(appt.endsAt.getTime() - appt.startsAt.getTime()).toBe(60 * MIN);
    expect(appt.startsAt).toEqual(new Date("2026-10-07T13:00:00Z")); // 10:00 en Argentina
    const locks = await locksOf(appt.id);
    expect(locks).toHaveLength(LOCKS_COMBO);
    expect(locks[0].startsAt).toEqual(new Date("2026-10-07T13:00:00Z"));
    expect(locks.at(-1)!.startsAt).toEqual(new Date("2026-10-07T13:55:00Z"));

    const combos = await slotsOf(MIERCOLES, combo);
    expect(combos).toMatchObject({ "09:00": true, "09:30": false, "10:00": false, "10:30": false, "11:00": true });
    const cortes = await slotsOf(MIERCOLES, corte);
    expect(cortes).toMatchObject({ "09:30": true, "10:00": false, "10:30": false, "11:00": true });
  });

  it("respeta la anticipación mínima de 30 minutos", async () => {
    setNow(zonedInstant(LUNES, "10:10"));
    const { slots } = await getAvailability(LUNES, corte);
    expect(slots[0].time).toBe("11:00");
  });

  it("no deja reservar fuera de la grilla ni en un día cerrado", async () => {
    await expectBookingError(book({ time: "10:15" }), 400);
    await expectBookingError(book({ time: "19:30" }), 400); // el combo terminaría 20:30
    await expectBookingError(book({ date: DOMINGO }), 400);
    await expectBookingError(book({ paymentMethod: "MERCADOPAGO" }), 400);
  });
});

describe("superposición", () => {
  it("rechaza turnos que pisan otro y acepta los contiguos", async () => {
    await book({ serviceId: combo, time: "10:00" });
    await expectBookingError(book({ serviceId: corte, time: "10:30" }), 409);
    await expectBookingError(book({ serviceId: combo, time: "09:30" }), 409);
    await expectBookingError(book({ serviceId: combo, time: "10:00" }), 409);
    await expect(book({ serviceId: combo, time: "11:00" })).resolves.toBeTruthy();
    await expect(book({ serviceId: corte, time: "09:30" })).resolves.toBeTruthy();
  });
});

describe("anti-spam", () => {
  it("un solo turno activo por celular, aunque se escriba en otro formato", async () => {
    await book({ clientPhone: "11 2345-6789" });
    for (const phone of ["+54 9 11 2345 6789", "011 15 2345 6789", "5491123456789"]) {
      await expectBookingError(book({ clientPhone: phone, time: "15:00" }), 409);
    }
    // Otro celular sí puede.
    await expect(book({ clientPhone: "0351 15 123 4567", time: "15:00" })).resolves.toBeTruthy();
  });

  it("el celular vuelve a poder reservar cuando su turno se cancela", async () => {
    const appt = await book({ clientPhone: "11 2345-6789" });
    await adminCancel(appt.id);
    await expect(book({ clientPhone: "+54 9 11 2345 6789", time: "15:00" })).resolves.toBeTruthy();
  });

  it("rechaza un celular inválido", async () => {
    await expectBookingError(book({ clientPhone: "123" }), 400);
  });

  it("máximo 3 reservas por hora por IP", async () => {
    const ip = "200.1.2.3";
    await book({ time: "09:00" }, ip);
    await book({ time: "11:00" }, ip);
    await book({ time: "13:00" }, ip);
    await expectBookingError(book({ time: "15:00" }, ip), 429);
    // Otra IP no está limitada.
    await expect(book({ time: "15:00" }, "200.9.9.9")).resolves.toBeTruthy();
    // Pasada la hora, la misma IP puede volver a reservar.
    advance(61);
    await expect(book({ time: "17:00" }, ip)).resolves.toBeTruthy();
  });
});

describe("vencimiento de reservas en efectivo", () => {
  it("vence a los 15 minutos y releaseExpired() libera los SlotLock", async () => {
    const appt = await book({ time: "10:00" });
    expect(appt.status).toBe("PENDIENTE_WHATSAPP");
    expect(appt.expiresAt).toEqual(new Date(AHORA.getTime() + 15 * MIN));

    advance(14);
    await releaseExpired();
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe("PENDIENTE_WHATSAPP");
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);

    advance(2);
    await releaseExpired();
    const vencido = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(vencido).toMatchObject({ status: "CANCELADO", cancelReason: "EXPIRADO" });
    expect(vencido.cancelledAt).toEqual(new Date(Date.now()));
    expect(await locksOf(appt.id)).toHaveLength(0);
    expect(await prisma.slotLock.count()).toBe(0);
    expect((await slotsOf(MIERCOLES, combo))["10:00"]).toBe(true);
  });

  it("el horario vencido se puede volver a reservar (y el mismo celular también)", async () => {
    await book({ clientPhone: "11 2345-6789", time: "10:00" });
    advance(16);
    await expect(book({ clientPhone: "11 2345-6789", time: "10:00" })).resolves.toBeTruthy();
  });

  it("solo libera los SlotLock de los turnos cancelados", async () => {
    const vence = await book({ time: "10:00" });
    advance(10);
    const sigue = await book({ time: "12:00" });
    advance(6);
    await releaseExpired();
    expect(await locksOf(vence.id)).toHaveLength(0);
    expect(await locksOf(sigue.id)).toHaveLength(LOCKS_COMBO);
  });

  it("markClientNotified extiende el vencimiento (no lo anula)", async () => {
    const appt = await book({ time: "10:00" });
    advance(5);
    await markClientNotified(appt.accessToken);
    advance(60);
    await releaseExpired();
    const sigue = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(sigue.status).toBe("PENDIENTE_WHATSAPP");
    expect(sigue.clientNotifiedAt).not.toBeNull();
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);
    // Ya avisó: no se puede marcar de nuevo.
    await expectBookingError(markClientNotified(appt.accessToken), 409);
    // Y el barbero todavía lo puede confirmar.
    await adminConfirm(appt.id);
  });

  it("si el barbero no confirma, vence a las 12 horas del aviso y libera el horario y el celular", async () => {
    const appt = await book({ time: "10:00", clientPhone: "11 5555-0000" });
    await markClientNotified(appt.accessToken);
    advance(12 * 60 - 1);
    await releaseExpired();
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("PENDIENTE_WHATSAPP");
    advance(2);
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("CANCELADO");
    expect(await locksOf(appt.id)).toHaveLength(0);
    await expect(book({ time: "10:00", clientPhone: "11 5555-0000" })).resolves.toBeTruthy();
  });

  it("el aviso no retiene el horario más allá del inicio del turno", async () => {
    setNow(zonedInstant(MIERCOLES, "08:00"));
    const appt = await book({ time: "10:00" });
    await markClientNotified(appt.accessToken);
    const { expiresAt } = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(expiresAt).toEqual(appt.startsAt);
  });

  it("markClientNotified falla si el turno ya venció", async () => {
    const appt = await book({ time: "10:00" });
    advance(16);
    await expectBookingError(markClientNotified(appt.accessToken), 409);
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("CANCELADO");
  });
});

describe("cancelación del cliente", () => {
  it("puede cancelar si faltan más de 24 h", async () => {
    const appt = await book({ date: MIERCOLES, time: "10:00" });
    await cancelByClient(appt.accessToken);
    const cancelado = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(cancelado).toMatchObject({ status: "CANCELADO", cancelReason: "CLIENTE" });
    expect(await locksOf(appt.id)).toHaveLength(0);
    await expectBookingError(cancelByClient(appt.accessToken), 409);
  });

  it("no puede cancelar si faltan menos de 24 h", async () => {
    const appt = await book({ date: LUNES, time: "18:00" });
    await expectBookingError(cancelByClient(appt.accessToken), 400);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe("PENDIENTE_WHATSAPP");
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);
  });

  it("el límite de 24 h se cuenta desde ahora", async () => {
    const appt = await book({ date: "2026-10-06", time: "09:00" }); // martes 09:00: faltan 25 h
    await adminConfirm(appt.id);
    advance(61); // ahora faltan 23:59 h
    await expectBookingError(cancelByClient(appt.accessToken), 400);
  });

  it("token inexistente → 404", async () => {
    await expectBookingError(cancelByClient("no-existe"), 404);
  });
});

describe("lookupAppointment", () => {
  const IP = "190.0.0.1";

  it("encuentra el turno con el código en minúsculas y el celular en otro formato", async () => {
    const appt = await book({ clientPhone: "11 2345-6789" });
    await expect(lookupAppointment(`  ${appt.code.toLowerCase()} `, "+54 9 11 2345 6789", IP)).resolves.toBe(appt.accessToken);
    await expect(lookupAppointment(appt.code, "011 15 2345 6789", IP)).resolves.toBe(appt.accessToken);
  });

  it("mismo 404 si el código no existe o el celular no coincide", async () => {
    const appt = await book({ clientPhone: "11 2345-6789" });
    await expectBookingError(lookupAppointment(appt.code, "11 9999-9999", IP), 404);
    await expectBookingError(lookupAppointment(appt.code, "123", IP), 404);
    await expectBookingError(lookupAppointment("TURN-XXXXXX", "11 2345-6789", IP), 404);
  });

  it("bloquea un código después de 5 fallos, aunque se cambie de IP", async () => {
    const appt = await book({ clientPhone: "11 2345-6789" });
    for (let i = 0; i < 5; i++) await expectBookingError(lookupAppointment(appt.code, `11 9999-000${i}`, `1.1.1.${i}`), 404);
    await expectBookingError(lookupAppointment(appt.code, "11 2345-6789", "2.2.2.2"), 429);
    advance(16);
    await expect(lookupAppointment(appt.code, "11 2345-6789", "2.2.2.2")).resolves.toBe(appt.accessToken);
  });

  it("limita las búsquedas por IP", async () => {
    for (let i = 0; i < 10; i++) await expectBookingError(lookupAppointment(`TURN-AAAAA${i}`, "11 2345-6789", IP), 404);
    await expectBookingError(lookupAppointment("TURN-BBBBBB", "11 2345-6789", IP), 429);
  });
});

describe("panel del barbero", () => {
  it("confirmar: queda CONFIRMADO, sin vencimiento y con sus horarios ocupados", async () => {
    const appt = await book({ time: "10:00" });
    await adminConfirm(appt.id);
    advance(60);
    await releaseExpired();
    const confirmado = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(confirmado.status).toBe("CONFIRMADO");
    expect(confirmado.expiresAt).toBeNull();
    expect(confirmado.confirmedAt).not.toBeNull();
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);
    await expectBookingError(adminConfirm(appt.id), 409);
  });

  it("no se puede confirmar un turno vencido", async () => {
    const appt = await book();
    advance(16);
    await expectBookingError(adminConfirm(appt.id), 409);
  });

  it("rechazar: cancela con motivo RECHAZADO y libera horarios", async () => {
    const appt = await book({ time: "10:00" });
    await adminReject(appt.id);
    const rechazado = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(rechazado).toMatchObject({ status: "CANCELADO", cancelReason: "RECHAZADO" });
    expect(await locksOf(appt.id)).toHaveLength(0);
    await expectBookingError(adminReject(appt.id), 409);
  });

  it("no se puede rechazar ni cancelar un turno vencido (queda como EXPIRADO)", async () => {
    const appt = await book();
    advance(16);
    await expectBookingError(adminReject(appt.id), 409);
    await expectBookingError(adminCancel(appt.id), 409);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).cancelReason).toBe("EXPIRADO");
  });

  it("no se puede rechazar un turno confirmado", async () => {
    const appt = await book();
    await adminConfirm(appt.id);
    await expectBookingError(adminReject(appt.id), 409);
  });

  it("cancelar: cancela un confirmado con motivo BARBERO y libera horarios", async () => {
    const appt = await book({ date: LUNES, time: "18:00" }); // aunque falten menos de 24 h
    await adminConfirm(appt.id);
    await adminCancel(appt.id);
    const cancelado = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(cancelado).toMatchObject({ status: "CANCELADO", cancelReason: "BARBERO" });
    expect(await locksOf(appt.id)).toHaveLength(0);
    expect((await slotsOf(LUNES, combo))["18:00"]).toBe(true);
    await expectBookingError(adminCancel(appt.id), 409);
  });

  it("id inexistente → 409", async () => {
    await expectBookingError(adminConfirm("no-existe"), 409);
    await expectBookingError(adminReject("no-existe"), 409);
    await expectBookingError(adminCancel("no-existe"), 409);
  });
});

describe("bloqueos", () => {
  it("bloquear ocupa las unidades y desbloquear las libera", async () => {
    await createBlock(MIERCOLES, "12:00", "13:00", "  Almuerzo ");
    const block = await prisma.blockedSlot.findFirstOrThrow({ include: { slotLocks: true } });
    expect(block.reason).toBe("Almuerzo");
    expect(block.slotLocks).toHaveLength(LOCKS_COMBO);
    expect(await slotsOf(MIERCOLES, combo)).toMatchObject({ "11:00": true, "11:30": false, "12:00": false, "12:30": false, "13:00": true });
    await expectBookingError(book({ time: "12:30", serviceId: corte }), 409);

    await deleteBlock(block.id);
    expect(await prisma.slotLock.count()).toBe(0);
    expect(await slotsOf(MIERCOLES, combo)).toMatchObject({ "11:30": true, "12:00": true, "12:30": true });
  });

  it("un bloqueo que choca con un turno falla y no deja nada a medias", async () => {
    const appt = await book({ time: "10:00" }); // ocupa 10:00 y 10:30
    await expectBookingError(createBlock(MIERCOLES, "09:00", "11:00"), 409);
    await expectBookingError(createBlock(MIERCOLES, "10:30", "11:00"), 409);
    expect(await prisma.blockedSlot.count()).toBe(0);
    expect(await prisma.slotLock.count()).toBe(LOCKS_COMBO);
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);
  });

  it("un bloqueo que choca con otro bloqueo falla", async () => {
    await createBlock(MIERCOLES, "12:00", "13:00");
    await expectBookingError(createBlock(MIERCOLES, "12:30", "14:00"), 409);
    expect(await prisma.blockedSlot.count()).toBe(1);
  });

  it("se puede bloquear sobre un turno ya vencido", async () => {
    await book({ time: "10:00" });
    advance(16);
    await expect(createBlock(MIERCOLES, "10:00", "11:00")).resolves.toBeUndefined();
  });

  it("valida grilla y rango", async () => {
    await expectBookingError(createBlock(MIERCOLES, "10:15", "11:00"), 400);
    await expectBookingError(createBlock(MIERCOLES, "11:00", "11:00"), 400);
    await expectBookingError(createBlock(MIERCOLES, "12:00", "11:00"), 400);
    await expectBookingError(createBlock("mañana", "10:00", "11:00"), 400);
  });

  it("borrar un bloqueo inexistente → 404", async () => {
    await expectBookingError(deleteBlock("no-existe"), 404);
  });
});

describe("concurrencia", () => {
  it("dos reservas simultáneas del mismo horario: solo una gana", async () => {
    const results = await Promise.allSettled([
      book({ time: "10:00" }),
      book({ time: "10:00" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    const error = (fail[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(BookingError);
    expect(error.status).toBe(409);
    // Las dos pasan el chequeo de disponibilidad; la que pierde choca con la restricción única de SlotLock.
    expect(error.message).toMatch(/se acaba de ocupar/);
    expect(await prisma.appointment.count()).toBe(1);
    expect(await prisma.slotLock.count()).toBe(LOCKS_COMBO);
  });

  it("dos reservas simultáneas que se superponen en parte: solo una gana", async () => {
    const results = await Promise.allSettled([
      book({ serviceId: combo, time: "10:00" }),
      book({ serviceId: corte, time: "10:30" }),
      book({ serviceId: combo, time: "09:30" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("la restricción única de SlotLock impide la doble reserva aunque se saltee el chequeo previo", async () => {
    const appt = await book({ time: "10:00" });
    await expect(
      prisma.slotLock.create({ data: { startsAt: appt.startsAt } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("arreglos de la revisión de seguridad", () => {
  it("cambiar la unidad de agenda no permite turnos superpuestos", async () => {
    await book({ serviceId: corte, time: "10:00" }); // 10:00 a 10:30
    const settings = await getSettings();
    await updateSettings({
      ...settings,
      weeklyHours: LUNES_A_SABADO.map((weekday) => ({ weekday, open: "09:00", close: "20:00" })),
      slotDurationMin: 15,
    });
    const cortes = await slotsOf(MIERCOLES, corte);
    expect(cortes).toMatchObject({ "09:30": true, "09:45": false, "10:00": false, "10:15": false, "10:30": true });
    await expectBookingError(book({ serviceId: corte, time: "10:15" }), 409);
  });

  it("dos reservas simultáneas con el mismo celular: solo una gana", async () => {
    const results = await Promise.allSettled([
      book({ time: "10:00", clientPhone: "11 7777-0000" }),
      book({ time: "15:00", clientPhone: "+54 9 11 7777 0000" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((failed.reason as BookingError).status).toBe(409);
    expect(await prisma.appointment.count({ where: { status: { not: "CANCELADO" } } })).toBe(1);
  });

  it("un celular cuyo turno ya pasó puede volver a reservar", async () => {
    await book({ time: "10:00", clientPhone: "11 6666-0000" }).then((a) => adminConfirm(a.id));
    setNow(zonedInstant(MIERCOLES, "11:30"));
    await expect(book({ date: "2026-10-08", time: "10:00", clientPhone: "11 6666-0000" })).resolves.toBeTruthy();
  });

  it("no se puede rechazar un turno que el barbero ya confirmó", async () => {
    const appt = await book();
    await adminConfirm(appt.id);
    await expectBookingError(adminReject(appt.id), 409);
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("CONFIRMADO");
  });

  it("los bloqueos tienen que estar dentro del horario de atención", async () => {
    await expectBookingError(createBlock(MIERCOLES, "08:00", "10:00"), 400);
    await expectBookingError(createBlock(MIERCOLES, "19:00", "21:00"), 400);
  });

  it("rechaza fechas que no existen", () => {
    expect(isDateKey("2026-02-31")).toBe(false);
  });
});

describe("horario por día de la semana", () => {
  const SABADO = "2026-10-10";
  const base = async () => ({ ...(await getSettings()), slotDurationMin: 30 });

  it("cada día usa su propio horario y un día sin horario queda cerrado", async () => {
    await updateSettings({
      ...(await base()),
      weeklyHours: [
        ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: "09:00", close: "20:00" })),
        { weekday: 6, open: "10:00", close: "14:00" },
      ],
    });
    const sabado = await getAvailability(SABADO, corte);
    expect(sabado.slots[0].time).toBe("10:00");
    expect(sabado.slots.at(-1)!.time).toBe("13:30");
    const miercoles = await getAvailability(MIERCOLES, corte);
    expect(miercoles.slots.at(-1)!.time).toBe("19:30");
    // El combo de 60 min no puede empezar 13:30 si el sábado cierra 14:00.
    await expectBookingError(book({ date: SABADO, time: "13:30" }), 400);
    await expect(book({ date: SABADO, time: "13:00" })).resolves.toBeTruthy();
    // Los bloqueos respetan el horario del día.
    await expectBookingError(createBlock(SABADO, "15:00", "16:00"), 400);
    await expectBookingError(createBlock(DOMINGO, "10:00", "11:00"), 400);
  });

  it("valida cada día por separado", async () => {
    const settings = await base();
    await expectBookingError(
      updateSettings({ ...settings, weeklyHours: [{ weekday: 6, open: "14:00", close: "10:00" }] }),
      400,
    );
    await expectBookingError(
      updateSettings({ ...settings, weeklyHours: [{ weekday: 6, open: "10:15", close: "14:00" }] }),
      400,
    );
  });

  it("agrupa los días seguidos con el mismo horario", () => {
    expect(
      describeWeek('{"1":["09:00","20:00"],"2":["09:00","20:00"],"3":["09:00","20:00"],"6":["10:00","14:00"]}'),
    ).toEqual(["Lunes a Miércoles 09:00 a 20:00", "Sábado 10:00 a 14:00"]);
  });
});

describe("validaciones de fechas", () => {
  it("rechaza fechas que no existen", () => {
    expect(isDateKey("2026-02-31")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
  });
});
