import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Settings } from "lucide-react";
import { isAdmin } from "@/lib/admin-auth";
import { ACTIVE_STATUSES, getAgenda, weekStartOf } from "@/lib/booking";
import { CANCEL_REASON_LABEL, formatPrice, STATUS_LABEL, whatsappLink } from "@/lib/format";
import {
  addDaysToKey,
  dateKeyOf,
  formatLongDate,
  formatShortDay,
  formatTime,
  isDateKey,
  minutesOf,
  todayKey,
  zonedInstant,
} from "@/lib/time";
import { ActionButton, AdminLogin, BlockForm, LogoutButton } from "@/components/admin-controls";

export const metadata = { title: "Panel del barbero", robots: { index: false } };

const STATUS_DOT: Record<string, string> = {
  CONFIRMADO: "bg-ok",
  PENDIENTE_WHATSAPP: "bg-warn",
  PENDIENTE_PAGO: "bg-warn",
  CANCELADO: "bg-bad",
};

function gridTimes(opening: string, closing: string, unit: number) {
  const out: string[] = [];
  for (let m = minutesOf(opening); m <= minutesOf(closing); m += unit) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

function clientWhatsapp(a: { clientPhone: string; clientName: string; code: string }) {
  return whatsappLink(a.clientPhone, `Hola ${a.clientName}! Te escribo por tu turno ${a.code}.`);
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  if (!(await isAdmin())) return <AdminLogin />;

  const { fecha } = await searchParams;
  const date = typeof fecha === "string" && isDateKey(fecha) ? fecha : todayKey();
  const { settings, appointments, blocks, pending, week } = await getAgenda(date);

  const weekStart = weekStartOf(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const countByDay = new Map<string, number>();
  for (const a of week) {
    const key = dateKeyOf(a.startsAt);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const active = appointments.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const cancelled = appointments.filter((a) => a.status === "CANCELADO");
  const agenda = [
    ...active.map((a) => ({ kind: "appt" as const, at: a.startsAt, appt: a })),
    ...blocks.map((b) => ({ kind: "block" as const, at: b.startsAt, block: b })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime());

  const income = active.reduce((sum, a) => sum + a.price, 0);
  const times = gridTimes(settings.openingTime, settings.closingTime, settings.slotDurationMin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase">Panel</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/configuracion" className="btn-ghost px-3 py-2 text-sm">
            <Settings className="size-4" aria-hidden /> Configuración
          </Link>
          <LogoutButton />
        </div>
      </div>

      {pending.length > 0 && (
        <section className="card space-y-3 border-warn/40">
          <h2 className="font-semibold text-warn">Pendientes de confirmar por WhatsApp ({pending.length})</h2>
          <ul className="divide-y divide-line">
            {pending.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">
                    {a.clientName} · <span className="text-muted">{a.code}</span>
                  </p>
                  <p className="text-muted capitalize">
                    {formatLongDate(a.startsAt)} {formatTime(a.startsAt)} · {a.service.name}
                  </p>
                  <p className="text-xs">
                    {a.clientNotifiedAt ? (
                      <span className="text-ok">El cliente avisó que mandó el WhatsApp</span>
                    ) : (
                      <span className="text-muted">Vence a las {a.expiresAt ? formatTime(a.expiresAt) : "-"}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={clientWhatsapp(a)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-3"
                    aria-label={`WhatsApp a ${a.clientName}`}
                  >
                    <MessageCircle className="size-4" aria-hidden />
                  </a>
                  <ActionButton url={`/api/admin/appointments/${a.id}`} body={{ action: "confirm" }} className="btn-primary px-4">
                    Confirmar
                  </ActionButton>
                  <ActionButton
                    url={`/api/admin/appointments/${a.id}`}
                    body={{ action: "reject" }}
                    className="btn-danger px-4"
                    confirmText="¿Rechazar?"
                  >
                    Rechazar
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Link href={`/admin?fecha=${addDaysToKey(weekStart, -7)}`} className="btn-ghost px-3 py-2" aria-label="Semana anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">
            Hoy
          </Link>
          <Link href={`/admin?fecha=${addDaysToKey(weekStart, 7)}`} className="btn-ghost px-3 py-2" aria-label="Semana siguiente">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => (
            <Link
              key={d}
              href={`/admin?fecha=${d}`}
              className={`rounded-xl border px-1 py-2 text-center text-xs capitalize ${
                d === date ? "border-brass bg-brass text-black" : "border-line hover:border-muted"
              }`}
            >
              <span className="block">{formatShortDay(d)}</span>
              <span className="mt-1 block text-base font-semibold">{countByDay.get(d) ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold capitalize">{formatLongDate(zonedInstant(date, "12:00"))}</h2>
          <p className="text-sm text-muted">
            {active.length} turnos · {formatPrice(income)}
          </p>
        </div>

        {agenda.length === 0 ? (
          <p className="text-sm text-muted">No hay turnos ni bloqueos este día.</p>
        ) : (
          <ul className="space-y-2">
            {agenda.map((item) =>
              item.kind === "appt" ? (
                <li
                  key={item.appt.id}
                  className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex gap-3 text-sm">
                    <span className="font-display text-lg tabular-nums">{formatTime(item.appt.startsAt)}</span>
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <span className={`size-2 rounded-full ${STATUS_DOT[item.appt.status]}`} aria-hidden />
                        {item.appt.clientName}
                      </p>
                      <p className="text-muted">
                        {item.appt.service.name} · hasta {formatTime(item.appt.endsAt)} · {formatPrice(item.appt.price)} ·{" "}
                        {item.appt.paymentMethod === "EFECTIVO" ? "Efectivo" : "Mercado Pago"}
                      </p>
                      <p className="text-xs text-muted">
                        {STATUS_LABEL[item.appt.status]} · {item.appt.code} · +{item.appt.clientPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={clientWhatsapp(item.appt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost px-3 py-2"
                      aria-label={`WhatsApp a ${item.appt.clientName}`}
                    >
                      <MessageCircle className="size-4" aria-hidden />
                    </a>
                    <ActionButton
                      url={`/api/admin/appointments/${item.appt.id}`}
                      body={{ action: "cancel" }}
                      className="btn-danger px-3 py-2 text-sm"
                      confirmText="¿Cancelar turno?"
                    >
                      Cancelar
                    </ActionButton>
                  </div>
                </li>
              ) : (
                <li
                  key={item.block.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line p-3 text-sm"
                >
                  <p>
                    <span className="font-display text-lg tabular-nums">{formatTime(item.block.startsAt)}</span>{" "}
                    <span className="text-muted">
                      a {formatTime(item.block.endsAt)} · Bloqueado{item.block.reason ? ` (${item.block.reason})` : ""}
                    </span>
                  </p>
                  <ActionButton url={`/api/admin/blocks/${item.block.id}`} method="DELETE" className="btn-ghost px-3 py-2 text-sm">
                    Desbloquear
                  </ActionButton>
                </li>
              ),
            )}
          </ul>
        )}

        {cancelled.length > 0 && (
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">Cancelados ({cancelled.length})</summary>
            <ul className="mt-2 space-y-1">
              {cancelled.map((a) => (
                <li key={a.id}>
                  {formatTime(a.startsAt)} · {a.clientName} · {a.service.name} ·{" "}
                  {a.cancelReason ? CANCEL_REASON_LABEL[a.cancelReason] : "Cancelado"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <BlockForm date={date} times={times} />
    </div>
  );
}
