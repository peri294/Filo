import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminCancel,
  adminConfirm,
  adminReject,
  ANY_BARBER,
  bookableDates,
  cancelByClient,
  createBlock,
  deleteBlock,
  getAgenda,
  getAppointmentByToken,
  getAvailability,
  listClientAppointments,
  LOCK_UNIT_MIN,
  markAttendance,
  markClientNotified,
  releaseExpired,
} from "@/lib/booking";
import { createBarber, deleteBarber, updateBarber, updateSettings } from "@/lib/admin-config";
import { prisma } from "@/lib/db";
import { getMetrics } from "@/lib/metrics";
import { describeWeek } from "@/lib/schedule";
import { createTenant, setTenantActive } from "@/lib/superadmin";
import { isDateKey, zonedInstant } from "@/lib/time";
import {
  adminOf,
  advance,
  AHORA,
  barberOf,
  book,
  DOMINGO,
  expectBookingError,
  locksOf,
  LUNES,
  makeClient,
  makeShop,
  MIERCOLES,
  resetDb,
  SABADO,
  setNow,
  slotsOf,
  type Shop,
} from "./fixtures";

const LOCKS_COMBO = 60 / LOCK_UNIT_MIN;
const LUNES_A_SABADO = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: "09:00", close: "20:00" }));

let shop: Shop;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(AHORA);
  await resetDb();
  shop = await makeShop();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const settingsOf = (s: Shop) => ({
  name: s.tenant.name,
  address: s.tenant.address,
  whatsapp: s.tenant.whatsapp,
  weeklyHours: LUNES_A_SABADO,
  slotDurationMin: 30,
  bookingWindowDays: 30,
  minNoticeMin: 30,
});

async function reload(s: Shop) {
  s.tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } });
}

describe("días y disponibilidad", () => {
  it("se reserva de lunes a sábado; el domingo está cerrado", async () => {
    const dates = bookableDates(shop.tenant);
    expect(dates).toContain(LUNES);
    expect(dates).not.toContain(DOMINGO);
    expect((await getAvailability(shop.tenant, DOMINGO, shop.corte, ANY_BARBER)).open).toBe(false);
  });

  it("un combo de 60 min ocupa sus bloques de 5 minutos y bloquea los inicios que se superponen", async () => {
    const appt = await book(shop.tenant, { serviceId: shop.combo, barberId: shop.ana.id });
    expect(appt.startsAt).toEqual(new Date("2026-10-07T13:00:00Z")); // 10:00 en Argentina
    const locks = await locksOf(appt.id);
    expect(locks).toHaveLength(LOCKS_COMBO);
    expect(locks.every((l) => l.barberId === shop.ana.id)).toBe(true);
    expect(locks.at(-1)!.startsAt).toEqual(new Date("2026-10-07T13:55:00Z"));

    expect(await slotsOf(shop.tenant, MIERCOLES, shop.combo, shop.ana.id)).toMatchObject({
      "09:00": true,
      "09:30": false,
      "10:00": false,
      "10:30": false,
      "11:00": true,
    });
  });

  it("respeta la anticipación mínima y la grilla", async () => {
    setNow(zonedInstant(LUNES, "10:10"));
    const { slots } = await getAvailability(shop.tenant, LUNES, shop.corte, shop.ana.id);
    expect(slots[0].time).toBe("11:00");
    await expectBookingError(book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id, time: "10:15" }), 400);
    await expectBookingError(book(shop.tenant, { serviceId: shop.combo, barberId: shop.ana.id, time: "19:30" }), 400);
    await expectBookingError(
      book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id, paymentMethod: "MERCADOPAGO" }),
      400,
    );
  });

  it("un servicio de otra barbería no se puede usar", async () => {
    const otra = await makeShop("dos");
    await expectBookingError(getAvailability(shop.tenant, MIERCOLES, otra.corte, ANY_BARBER), 404);
    await expectBookingError(book(shop.tenant, { serviceId: otra.corte, barberId: ANY_BARBER }), 404);
    await expectBookingError(book(shop.tenant, { serviceId: shop.corte, barberId: otra.ana.id }), 404);
  });
});

describe("agenda por barbero", () => {
  it("dos barberos atienden a la misma hora; con los dos ocupados el horario se llena", async () => {
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id });
    await expectBookingError(book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }), 409);
    expect((await slotsOf(shop.tenant, MIERCOLES, shop.corte, ANY_BARBER))["10:00"]).toBe(false);
  });

  it('"El primero disponible" asigna al barbero libre y con menos turnos', async () => {
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id, time: "15:00" });
    expect((await slotsOf(shop.tenant, MIERCOLES, shop.corte, ANY_BARBER))["15:00"]).toBe(true);
    const libre = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "15:00" });
    expect(libre.barberId).toBe(shop.beto.id);
    const otro = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "17:00" });
    expect(otro.barberId).toBe(shop.ana.id); // empatados en cantidad: el primero en orden
  });

  it('dos reservas "cualquiera" simultáneas van a barberos distintos', async () => {
    const results = await Promise.allSettled([
      book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }),
      book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }),
    ]);
    const ok = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<{ barberId: string }>).value);
    expect(ok).toHaveLength(2);
    expect(new Set(ok.map((a) => a.barberId)).size).toBe(2);
  });

  it("dos reservas simultáneas del mismo barbero y horario: solo una gana", async () => {
    const results = await Promise.allSettled([
      book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id }),
      book(shop.tenant, { serviceId: shop.combo, barberId: shop.ana.id, time: "09:30" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("cada barbero tiene su horario, recortado al del local", async () => {
    await updateBarber(shop.tenant, shop.beto.id, {
      weeklyHours: [
        { weekday: 3, open: "14:00", close: "22:00" }, // el local cierra 20:00
        { weekday: 6, open: "09:00", close: "13:00" },
      ],
    });
    const betoMiercoles = await getAvailability(shop.tenant, MIERCOLES, shop.corte, shop.beto.id);
    expect(betoMiercoles.slots[0].time).toBe("14:00");
    expect(betoMiercoles.slots.at(-1)!.time).toBe("19:30");
    expect((await getAvailability(shop.tenant, LUNES, shop.corte, shop.beto.id)).open).toBe(false);
    expect((await getAvailability(shop.tenant, SABADO, shop.corte, shop.beto.id)).slots.at(-1)!.time).toBe("12:30");
    // Con "cualquiera", el lunes igual hay turnos (los de Ana).
    expect((await getAvailability(shop.tenant, LUNES, shop.corte, ANY_BARBER)).open).toBe(true);
  });

  it("un barbero desactivado no recibe reservas", async () => {
    await updateBarber(shop.tenant, shop.beto.id, { active: false });
    await expectBookingError(book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id }), 404);
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER });
    expect(appt.barberId).toBe(shop.ana.id);
  });
});

describe("anti-spam", () => {
  it("un turno activo por cliente en cada barbería, pero puede reservar en otra", async () => {
    const client = await makeClient();
    await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    await expectBookingError(
      book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "15:00" }, { client }),
      409,
    );
    const otra = await makeShop("dos");
    await expect(book(otra.tenant, { serviceId: otra.corte, barberId: ANY_BARBER }, { client })).resolves.toBeTruthy();
  });

  it("dos reservas simultáneas del mismo cliente: solo una gana", async () => {
    const client = await makeClient();
    const results = await Promise.allSettled([
      book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id }, { client }),
      book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id, time: "15:00" }, { client }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("después de cancelar, o cuando el turno ya pasó, el cliente puede volver a reservar", async () => {
    const client = await makeClient();
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    await cancelByClient(client.id, appt.accessToken);
    const otro = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "11:00" }, { client });
    await adminConfirm(adminOf(shop), otro.id);
    setNow(zonedInstant(MIERCOLES, "12:00"));
    await expect(
      book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, date: "2026-10-08" }, { client }),
    ).resolves.toBeTruthy();
  });

  it("máximo 3 reservas por hora desde la misma IP", async () => {
    for (const time of ["10:00", "11:00", "12:00"]) {
      await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time }, { ip: "9.9.9.9" });
    }
    await expectBookingError(
      book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "13:00" }, { ip: "9.9.9.9" }),
      429,
    );
  });
});

describe("vencimiento y aviso por WhatsApp", () => {
  it("vence a los 15 minutos y libera el horario", async () => {
    const appt = await book(shop.tenant, { serviceId: shop.combo, barberId: shop.ana.id });
    advance(14);
    await releaseExpired();
    expect(await locksOf(appt.id)).toHaveLength(LOCKS_COMBO);
    advance(2);
    await releaseExpired();
    const vencido = await getAppointmentByToken(appt.accessToken);
    expect(vencido?.status).toBe("CANCELADO");
    expect(vencido?.cancelReason).toBe("EXPIRADO");
    expect(await locksOf(appt.id)).toHaveLength(0);
  });

  it("el aviso extiende hasta 12 h y solo lo puede dar el dueño del turno", async () => {
    const client = await makeClient();
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    const otro = await makeClient();
    await expectBookingError(markClientNotified(otro.id, appt.accessToken), 404);
    await markClientNotified(client.id, appt.accessToken);
    advance(12 * 60 - 1);
    await releaseExpired();
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("PENDIENTE_WHATSAPP");
    advance(2);
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("CANCELADO");
  });
});

describe('cancelación y "Mis turnos" del cliente', () => {
  it("cancela con más de 24 h; con menos no; un turno ajeno da 404", async () => {
    const client = await makeClient();
    const lejos = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    await expectBookingError(cancelByClient((await makeClient()).id, lejos.accessToken), 404);
    await cancelByClient(client.id, lejos.accessToken);
    expect(await locksOf(lejos.id)).toHaveLength(0);

    setNow(zonedInstant(MIERCOLES, "08:00"));
    const cerca = await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    await expectBookingError(cancelByClient(client.id, cerca.accessToken), 400);
  });

  it("lista los turnos del cliente en todas las barberías", async () => {
    const client = await makeClient();
    const otra = await makeShop("dos");
    await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }, { client });
    await book(otra.tenant, { serviceId: otra.corte, barberId: ANY_BARBER }, { client });
    await book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER, time: "15:00" }); // de otro cliente
    const { upcoming } = await listClientAppointments(client.id);
    expect(upcoming).toHaveLength(2);
    expect(new Set(upcoming.map((a) => a.tenant.slug))).toEqual(new Set(["uno", "dos"]));
  });
});

describe("panel: permisos y aislamiento", () => {
  it("el admin gestiona los turnos de su barbería; el de otra barbería recibe 404", async () => {
    const otra = await makeShop("dos");
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id });
    await expectBookingError(adminConfirm(adminOf(otra), appt.id), 404);
    await expectBookingError(adminCancel(adminOf(otra), appt.id), 404);
    await adminConfirm(adminOf(shop), appt.id);
    expect((await getAppointmentByToken(appt.accessToken))?.status).toBe("CONFIRMADO");
  });

  it("el barbero gestiona solo sus turnos", async () => {
    const deAna = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await expectBookingError(adminConfirm(barberOf(shop, shop.beto), deAna.id), 404);
    await expectBookingError(adminReject(barberOf(shop, shop.beto), deAna.id), 404);
    await adminConfirm(barberOf(shop, shop.ana), deAna.id);
  });

  it("el superadmin no gestiona agendas", async () => {
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await expectBookingError(adminConfirm({ role: "SUPERADMIN", tenantId: null, barberId: null }, appt.id), 404);
    await expectBookingError(
      getAgenda({ role: "SUPERADMIN", tenantId: null, barberId: null }, shop.tenant, MIERCOLES),
      403,
    );
  });

  it("no se puede rechazar un turno confirmado", async () => {
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await adminConfirm(adminOf(shop), appt.id);
    await expectBookingError(adminReject(adminOf(shop), appt.id), 409);
  });

  it("la agenda del barbero muestra solo sus turnos; el admin puede filtrar", async () => {
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id });
    expect((await getAgenda(barberOf(shop, shop.ana), shop.tenant, MIERCOLES)).appointments).toHaveLength(1);
    expect((await getAgenda(adminOf(shop), shop.tenant, MIERCOLES)).appointments).toHaveLength(2);
    expect((await getAgenda(adminOf(shop), shop.tenant, MIERCOLES, shop.beto.id)).appointments).toHaveLength(1);
    // Un barbero no puede ver la agenda de otro aunque lo pida.
    expect(
      (await getAgenda(barberOf(shop, shop.ana), shop.tenant, MIERCOLES, shop.beto.id)).appointments[0].barberId,
    ).toBe(shop.ana.id);
  });

  it("asistencia: solo turnos confirmados que ya empezaron", async () => {
    const appt = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id });
    await expectBookingError(markAttendance(barberOf(shop, shop.ana), appt.id, "ASISTIO"), 409); // pendiente
    await adminConfirm(adminOf(shop), appt.id);
    await expectBookingError(markAttendance(barberOf(shop, shop.ana), appt.id, "ASISTIO"), 409); // todavía no empezó
    setNow(zonedInstant(MIERCOLES, "10:05"));
    await expectBookingError(markAttendance(barberOf(shop, shop.beto), appt.id, "ASISTIO"), 404);
    await markAttendance(barberOf(shop, shop.ana), appt.id, "NO_VINO");
    expect((await getAppointmentByToken(appt.accessToken))?.attendance).toBe("NO_VINO");
  });
});

describe("bloqueos", () => {
  it("el admin bloquea a todos; si alguno tiene un turno en el rango, no se bloquea a nadie", async () => {
    await createBlock(adminOf(shop), shop.tenant, {
      barberId: ANY_BARBER,
      date: MIERCOLES,
      from: "12:00",
      to: "13:00",
    });
    expect(await prisma.blockedSlot.count()).toBe(2);
    expect((await slotsOf(shop.tenant, MIERCOLES, shop.corte, ANY_BARBER))["12:00"]).toBe(false);

    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id, time: "15:00" });
    await expectBookingError(
      createBlock(adminOf(shop), shop.tenant, { barberId: ANY_BARBER, date: MIERCOLES, from: "15:00", to: "16:00" }),
      409,
    );
    expect(await prisma.blockedSlot.count()).toBe(2);
  });

  it("el barbero bloquea solo su agenda y dentro de su horario", async () => {
    await expectBookingError(
      createBlock(barberOf(shop, shop.ana), shop.tenant, {
        barberId: ANY_BARBER,
        date: MIERCOLES,
        from: "12:00",
        to: "13:00",
      }),
      403,
    );
    await expectBookingError(
      createBlock(barberOf(shop, shop.ana), shop.tenant, {
        barberId: shop.beto.id,
        date: MIERCOLES,
        from: "12:00",
        to: "13:00",
      }),
      404,
    );
    await expectBookingError(
      createBlock(barberOf(shop, shop.ana), shop.tenant, {
        barberId: shop.ana.id,
        date: MIERCOLES,
        from: "08:00",
        to: "10:00",
      }),
      400,
    );
    await expectBookingError(
      createBlock(barberOf(shop, shop.ana), shop.tenant, {
        barberId: shop.ana.id,
        date: DOMINGO,
        from: "10:00",
        to: "11:00",
      }),
      400,
    );
    await createBlock(barberOf(shop, shop.ana), shop.tenant, {
      barberId: shop.ana.id,
      date: MIERCOLES,
      from: "12:00",
      to: "13:00",
    });
    expect((await slotsOf(shop.tenant, MIERCOLES, shop.corte, shop.ana.id))["12:00"]).toBe(false);
    expect((await slotsOf(shop.tenant, MIERCOLES, shop.corte, shop.beto.id))["12:00"]).toBe(true);
  });

  it("desbloquear: solo quien puede gestionar ese barbero", async () => {
    await createBlock(adminOf(shop), shop.tenant, {
      barberId: shop.ana.id,
      date: MIERCOLES,
      from: "12:00",
      to: "13:00",
    });
    const block = await prisma.blockedSlot.findFirstOrThrow();
    const otra = await makeShop("dos");
    await expectBookingError(deleteBlock(adminOf(otra), block.id), 404);
    await expectBookingError(deleteBlock(barberOf(shop, shop.beto), block.id), 404);
    await deleteBlock(barberOf(shop, shop.ana), block.id);
    expect(await prisma.slotLock.count()).toBe(0);
  });
});

describe("configuración", () => {
  it("horario por día del local (sábado especial)", async () => {
    await updateSettings(shop.tenant, {
      ...settingsOf(shop),
      weeklyHours: [...LUNES_A_SABADO.slice(0, 5), { weekday: 6, open: "10:00", close: "14:00" }],
    });
    await reload(shop);
    const sabado = await getAvailability(shop.tenant, SABADO, shop.corte, ANY_BARBER);
    expect(sabado.slots[0].time).toBe("10:00");
    expect(sabado.slots.at(-1)!.time).toBe("13:30");
    await expectBookingError(
      updateSettings(shop.tenant, {
        ...settingsOf(shop),
        weeklyHours: [{ weekday: 6, open: "14:00", close: "10:00" }],
      }),
      400,
    );
  });

  it("cambiar la unidad de agenda no permite turnos superpuestos", async () => {
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.ana.id }); // 10:00 a 10:30
    await updateSettings(shop.tenant, { ...settingsOf(shop), slotDurationMin: 15 });
    await reload(shop);
    expect(await slotsOf(shop.tenant, MIERCOLES, shop.corte, shop.ana.id)).toMatchObject({
      "09:30": true,
      "09:45": false,
      "10:00": false,
      "10:15": false,
      "10:30": true,
    });
  });

  it("alta de barbero con usuario; el celular no se puede repetir; no se borra si tiene turnos", async () => {
    const admin = await prisma.staffUser.create({
      data: { phone: "5491150000000", passwordHash: "x", name: "Admin", role: "ADMIN", tenantId: shop.tenant.id },
    });
    const carla = await createBarber(shop.tenant, admin, {
      name: "Carla",
      weeklyHours: null,
      sortOrder: 2,
      login: { phone: "11 5000-0001", password: "clave-segura" },
    });
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { barberId: carla.id } });
    expect(user).toMatchObject({ role: "BARBER", tenantId: shop.tenant.id, phone: "5491150000001" });
    await expectBookingError(
      createBarber(shop.tenant, admin, {
        name: "Otro",
        weeklyHours: null,
        sortOrder: 3,
        login: { phone: "11 5000-0001", password: "clave-segura" },
      }),
      409,
    );
    // El admin también atiende.
    const yo = await createBarber(shop.tenant, admin, { name: "Admin", weeklyHours: null, sortOrder: 4, isMe: true });
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: admin.id } })).barberId).toBe(yo.id);

    await book(shop.tenant, { serviceId: shop.corte, barberId: carla.id });
    await expectBookingError(deleteBarber(shop.tenant, adminOf(shop), carla.id), 409);
    // Darlo de baja corta su acceso al panel.
    await updateBarber(shop.tenant, carla.id, { active: false });
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { barberId: carla.id } })).active).toBe(false);
  });
});

describe("métricas", () => {
  it("cuenta turnos, ingresos, ausencias, cancelaciones y clientes nuevos o recurrentes", async () => {
    const habitual = await makeClient();
    // Turno anterior al período: hace que "habitual" sea recurrente.
    const viejo = await book(
      shop.tenant,
      { serviceId: shop.corte, barberId: shop.ana.id, date: LUNES, time: "10:00" },
      { client: habitual },
    );
    await adminConfirm(adminOf(shop), viejo.id);

    setNow(zonedInstant(LUNES, "12:00"));
    const a = await book(
      shop.tenant,
      { serviceId: shop.combo, barberId: shop.ana.id, time: "10:00" },
      { client: habitual },
    );
    const b = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id, time: "10:00" });
    const c = await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id, time: "11:00" });
    await book(shop.tenant, { serviceId: shop.corte, barberId: shop.beto.id, time: "12:00" }); // vence: no cuenta
    for (const id of [a.id, b.id]) await adminConfirm(adminOf(shop), id);
    await adminCancel(adminOf(shop), c.id);

    setNow(zonedInstant(MIERCOLES, "13:00"));
    await markAttendance(adminOf(shop), a.id, "ASISTIO");
    await markAttendance(adminOf(shop), b.id, "NO_VINO");

    const m = await getMetrics(shop.tenant, "2026-10-06", MIERCOLES);
    expect(m).toMatchObject({
      appointments: 2,
      attended: 1,
      noShow: 1,
      cancelled: 1,
      revenue: 17000,
      clients: 2,
      newClients: 1,
      returningClients: 1,
    });
    expect(m.noShowRate).toBe(0.5);
    expect(m.cancellationRate).toBeCloseTo(1 / 3);
    expect(m.barbers.map((r) => r.name)).toEqual(expect.arrayContaining(["Ana", "Beto"]));
    expect((await getMetrics(shop.tenant, "2026-10-06", MIERCOLES, shop.ana.id)).appointments).toBe(1);
  });
});

describe("superadmin", () => {
  const nueva = {
    name: "Nueva",
    slug: "nueva",
    whatsapp: "11 2222-3333",
    adminName: "Dueño",
    adminPhone: "11 2222-4444",
    adminPassword: "clave-segura",
  };

  it("crea la barbería con su admin; valida la dirección", async () => {
    const t = await createTenant(nueva);
    expect(await prisma.staffUser.findFirst({ where: { tenantId: t.id, role: "ADMIN" } })).toBeTruthy();
    await expectBookingError(createTenant({ ...nueva, adminPhone: "11 2222-5555" }), 409);
    await expectBookingError(createTenant({ ...nueva, slug: "panel", adminPhone: "11 2222-6666" }), 400);
    await expectBookingError(createTenant({ ...nueva, slug: "Con Espacios", adminPhone: "11 2222-7777" }), 400);
  });

  it("una barbería suspendida no recibe reservas", async () => {
    await setTenantActive(shop.tenant.id, false);
    await reload(shop);
    await expectBookingError(book(shop.tenant, { serviceId: shop.corte, barberId: ANY_BARBER }), 403);
  });
});

describe("utilidades", () => {
  it("rechaza fechas que no existen", () => {
    expect(isDateKey("2026-02-31")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
  });

  it("agrupa los días seguidos con el mismo horario", () => {
    expect(
      describeWeek('{"1":["09:00","20:00"],"2":["09:00","20:00"],"3":["09:00","20:00"],"6":["10:00","14:00"]}'),
    ).toEqual(["Lunes a Miércoles 09:00 a 20:00", "Sábado 10:00 a 14:00"]);
  });
});
