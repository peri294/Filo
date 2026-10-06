import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { releaseExpired } from "@/lib/booking";
import { prisma, type Tenant } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { addDaysToKey, isDateKey, TZ, zonedInstant } from "@/lib/time";

export type Ranking = { id: string; name: string; count: number; revenue: number };

/**
 * Métricas de una barbería (o de un barbero) entre dos fechas "YYYY-MM-DD", ambas incluidas.
 * - Ingresos: precio de los turnos donde se marcó que el cliente asistió.
 * - Cancelaciones: no cuentan las reservas que vencieron sin confirmarse.
 * - Ausencias: sobre los turnos con asistencia marcada.
 * - Cliente nuevo: su primer turno en esta barbería cae dentro del período.
 */
export async function getMetrics(tenant: Tenant, from: string, to: string, barberId?: string) {
  if (!isDateKey(from) || !isDateKey(to) || from > to) throw new BookingError(400, "Período inválido");
  const start = zonedInstant(from, "00:00");
  const end = zonedInstant(addDaysToKey(to, 1), "00:00");
  const scope = { tenantId: tenant.id, ...(barberId ? { barberId } : {}) };
  await releaseExpired(); // que las reservas vencidas no cuenten como turnos

  const appointments = await prisma.appointment.findMany({
    // Ojo: un NOT simple sobre cancelReason también descartaría los NULL (los turnos no cancelados).
    where: { ...scope, startsAt: { gte: start, lt: end }, OR: [{ cancelReason: null }, { cancelReason: { not: "EXPIRADO" } }] },
    include: { service: { select: { id: true, name: true } }, barber: { select: { id: true, name: true } } },
  });

  const cancelled = appointments.filter((a) => a.status === "CANCELADO");
  const kept = appointments.filter((a) => a.status !== "CANCELADO");
  const attended = kept.filter((a) => a.attendance === "ASISTIO");
  const noShow = kept.filter((a) => a.attendance === "NO_VINO");
  const pendingMark = kept.filter((a) => a.status === "CONFIRMADO" && !a.attendance && a.startsAt.getTime() < Date.now());

  // Clientes nuevos y recurrentes: se mira si tenían turnos anteriores en esta barbería.
  const clientIds = [...new Set(kept.map((a) => a.clientId))];
  const earlier = await prisma.appointment.findMany({
    where: { tenantId: tenant.id, clientId: { in: clientIds }, startsAt: { lt: start }, status: { not: "CANCELADO" } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  const returning = new Set(earlier.map((e) => e.clientId));

  const rank = (key: (a: (typeof kept)[number]) => { id: string; name: string }) => {
    const map = new Map<string, Ranking>();
    for (const a of kept) {
      const { id, name } = key(a);
      const row = map.get(id) ?? { id, name, count: 0, revenue: 0 };
      row.count++;
      if (a.attendance === "ASISTIO") row.revenue += a.price;
      map.set(id, row);
    }
    return [...map.values()].sort((x, y) => y.count - x.count);
  };

  // Demanda por día de la semana (0 = domingo) y hora, en hora de Argentina.
  const byWeekday = Array<number>(7).fill(0);
  const byHour = new Map<number, number>();
  for (const a of kept) {
    const weekday = Number(format(a.startsAt, "i", { in: tz(TZ) })) % 7;
    const hour = Number(format(a.startsAt, "H", { in: tz(TZ) }));
    byWeekday[weekday]++;
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  const marked = attended.length + noShow.length;
  const base = appointments.length;
  return {
    from,
    to,
    appointments: kept.length,
    attended: attended.length,
    noShow: noShow.length,
    pendingMark: pendingMark.length,
    cancelled: cancelled.length,
    cancellationRate: base ? cancelled.length / base : 0,
    noShowRate: marked ? noShow.length / marked : 0,
    revenue: attended.reduce((sum, a) => sum + a.price, 0),
    expectedRevenue: kept.filter((a) => a.attendance !== "NO_VINO").reduce((sum, a) => sum + a.price, 0),
    clients: clientIds.length,
    newClients: clientIds.filter((id) => !returning.has(id)).length,
    returningClients: clientIds.filter((id) => returning.has(id)).length,
    services: rank((a) => ({ id: String(a.service.id), name: a.service.name })),
    barbers: barberId ? [] : rank((a) => ({ id: a.barber.id, name: a.barber.name })),
    byWeekday,
    byHour: [...byHour].sort(([a], [b]) => a - b).map(([hour, count]) => ({ hour, count })),
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;
