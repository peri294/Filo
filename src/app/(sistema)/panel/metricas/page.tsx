import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentStaff } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getMetrics } from "@/lib/metrics";
import { addDaysToKey, isDateKey, todayKey } from "@/lib/time";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({ title: "Métricas", description: "Métricas de la barbería.", noIndex: true });

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-2">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-2.5 rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-brass" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function MetricasPage({ searchParams }: PageProps<"/panel/metricas">) {
  const user = await getCurrentStaff();
  if (!user || user.role === "SUPERADMIN" || !user.tenant?.active) redirect("/panel");
  const { dias, barbero } = await searchParams;

  const days = RANGES.some((r) => String(r.days) === dias) ? Number(dias) : 30;
  const to = todayKey();
  const from = addDaysToKey(to, -(days - 1));
  // El barbero ve solo sus números; el admin puede ver los de un barbero puntual.
  const barberId =
    user.role === "BARBER" ? (user.barberId ?? undefined) : typeof barbero === "string" && barbero ? barbero : undefined;
  const m = await getMetrics(user.tenant, isDateKey(from) ? from : to, to, barberId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/panel" className="btn-ghost px-3 py-2" aria-label="Volver al panel">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-3xl uppercase">Métricas</h1>
          <p className="text-sm text-muted">{user.role === "BARBER" ? "Tus números" : user.tenant.name}</p>
        </div>
      </div>

      <nav aria-label="Período" className="flex gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/panel/metricas?dias=${r.days}${barberId && user.role === "ADMIN" ? `&barbero=${barberId}` : ""}`}
            aria-current={r.days === days ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${r.days === days ? "border-brass bg-brass text-black" : "border-line hover:border-muted"}`}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Turnos" value={String(m.appointments)} hint={`${m.attended} vinieron`} />
        <Stat label="Ingresos" value={formatPrice(m.revenue)} hint={`Esperado: ${formatPrice(m.expectedRevenue)}`} />
        <Stat label="Ausencias" value={pct(m.noShowRate)} hint={`${m.noShow} no vinieron`} />
        <Stat label="Cancelaciones" value={pct(m.cancellationRate)} hint={`${m.cancelled} cancelados`} />
        <Stat label="Clientes" value={String(m.clients)} />
        <Stat label="Nuevos" value={String(m.newClients)} />
        <Stat label="Recurrentes" value={String(m.returningClients)} />
        <Stat label="Sin marcar" value={String(m.pendingMark)} hint="Turnos pasados sin asistencia" />
      </div>
      {m.pendingMark > 0 && (
        <p className="text-sm text-muted">
          Marcá &quot;Vino&quot; o &quot;No vino&quot; en la agenda para que los ingresos y las ausencias sean exactos.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Servicios más pedidos</h2>
          {m.services.length ? <Bars rows={m.services.map((s) => ({ label: s.name, value: s.count }))} /> : <p className="text-sm text-muted">Sin datos.</p>}
        </section>
        {m.barbers.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-semibold">Turnos por barbero</h2>
            <Bars rows={m.barbers.map((b) => ({ label: b.name, value: b.count }))} />
            <ul className="space-y-1 text-xs text-muted">
              {m.barbers.map((b) => (
                <li key={b.id}>
                  <Link href={`/panel/metricas?dias=${days}&barbero=${b.id}`} className="underline underline-offset-2">
                    Ver solo {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card space-y-3">
          <h2 className="font-semibold">Días con más demanda</h2>
          <Bars rows={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: DAYS[d], value: m.byWeekday[d] }))} />
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">Horarios con más demanda</h2>
          {m.byHour.length ? (
            <Bars rows={m.byHour.map((h) => ({ label: `${String(h.hour).padStart(2, "0")} hs`, value: h.count }))} />
          ) : (
            <p className="text-sm text-muted">Sin datos.</p>
          )}
        </section>
      </div>
    </div>
  );
}
