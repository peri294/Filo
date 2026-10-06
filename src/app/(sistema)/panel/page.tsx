import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Settings, Store } from "lucide-react";
import { getCurrentStaff } from "@/lib/auth";
import { ACTIVE_STATUSES, getAgenda, hasStarted, weekStartOf } from "@/lib/booking";
import { CANCEL_REASON_LABEL, formatPrice, STATUS_LABEL, whatsappLink } from "@/lib/format";
import { hoursFor } from "@/lib/schedule";
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
import { ActionButton, BlockForm } from "@/components/admin-controls";
import { LoginForm, LogoutButton } from "@/components/auth-forms";
import { StatusScreen } from "@/components/status-screen";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({ title: "Panel", description: "Panel de la barbería.", noIndex: true });

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

export default async function PanelPage({ searchParams }: PageProps<"/panel">) {
  const user = await getCurrentStaff();
  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="font-display text-3xl uppercase">Panel</h1>
          <p className="mt-1 text-sm text-muted">Para barberías: ingresá con tu celular y contraseña.</p>
        </div>
        <LoginForm endpoint="/api/panel/ingresar" redirectTo="/panel" recoverHref="/panel/recuperar" />
      </div>
    );
  }
  if (user.role === "SUPERADMIN") redirect("/superadmin");
  const tenant = user.tenant!;
  if (!tenant.active) {
    return (
      <StatusScreen
        icon={Store}
        eyebrow="Suspendida"
        title="Esta barbería está suspendida"
        actions={<LogoutButton endpoint="/api/panel/salir" redirectTo="/panel" className="btn-ghost" />}
      >
        <p>Comunicate con soporte para reactivarla.</p>
      </StatusScreen>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const { fecha, barbero } = await searchParams;
  const date = typeof fecha === "string" && isDateKey(fecha) ? fecha : todayKey();
  const filter = isAdmin && typeof barbero === "string" ? barbero : undefined;
  const { barbers, appointments, blocks, pending, week, barberId } = await getAgenda(user, tenant, date, filter);
  const showBarber = isAdmin && !barberId; // en la vista de todos se aclara de quién es cada turno

  const query = (params: { fecha?: string; barbero?: string | null }) => {
    const q = new URLSearchParams();
    const f = params.fecha ?? date;
    const b = params.barbero === undefined ? filter : params.barbero;
    if (f !== todayKey()) q.set("fecha", f);
    if (b) q.set("barbero", b);
    const s = q.toString();
    return s ? `/panel?${s}` : "/panel";
  };

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

  const hours = hoursFor(tenant.weeklyHours, date);
  const times = hours ? gridTimes(hours.open, hours.close, tenant.slotDurationMin) : null;
  const blockable = isAdmin ? barbers.filter((b) => b.active) : barbers.filter((b) => b.id === user.barberId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl uppercase">Panel</h1>
          <p className="text-sm text-muted">
            {tenant.name} · {user.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/panel/metricas" className="btn-ghost px-3 py-2 text-sm">
            <BarChart3 className="size-4" aria-hidden /> Métricas
          </Link>
          {isAdmin && (
            <Link href="/panel/configuracion" className="btn-ghost px-3 py-2 text-sm">
              <Settings className="size-4" aria-hidden /> Configuración
            </Link>
          )}
          <Link href={`/${tenant.slug}`} className="btn-ghost px-3 py-2 text-sm" target="_blank">
            <ExternalLink className="size-4" aria-hidden /> Ver página
          </Link>
          <LogoutButton endpoint="/api/panel/salir" redirectTo="/panel" />
        </div>
      </div>

      {isAdmin && barbers.length > 1 && (
        <nav aria-label="Filtrar por barbero" className="flex flex-wrap gap-2">
          {[{ id: null as string | null, name: "Todos" }, ...barbers.map((b) => ({ id: b.id as string | null, name: b.name }))].map((b) => (
            <Link
              key={b.id ?? "todos"}
              href={query({ barbero: b.id })}
              aria-current={(barberId ?? null) === b.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                (barberId ?? null) === b.id ? "border-brass bg-brass text-black" : "border-line hover:border-muted"
              }`}
            >
              {b.name}
            </Link>
          ))}
        </nav>
      )}

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
                  <p className="text-muted first-letter:uppercase">
                    {formatLongDate(a.startsAt)} {formatTime(a.startsAt)} · {a.service.name}
                    {showBarber && ` · con ${a.barber.name}`}
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
                  <a href={clientWhatsapp(a)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3" aria-label={`WhatsApp a ${a.clientName}`}>
                    <MessageCircle className="size-4" aria-hidden />
                  </a>
                  <ActionButton url={`/api/panel/turnos/${a.id}`} body={{ action: "confirm" }} className="btn-primary px-4">
                    Confirmar
                  </ActionButton>
                  <ActionButton url={`/api/panel/turnos/${a.id}`} body={{ action: "reject" }} className="btn-danger px-4" confirmText="¿Rechazar?">
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
          <Link href={query({ fecha: addDaysToKey(weekStart, -7) })} className="btn-ghost px-3 py-2" aria-label="Semana anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={query({ fecha: todayKey() })} className="text-sm text-muted hover:text-ink">
            Hoy
          </Link>
          <Link href={query({ fecha: addDaysToKey(weekStart, 7) })} className="btn-ghost px-3 py-2" aria-label="Semana siguiente">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => (
            <Link
              key={d}
              href={query({ fecha: d })}
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
          <h2 className="font-semibold first-letter:uppercase">{formatLongDate(zonedInstant(date, "12:00"))}</h2>
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
                <li key={item.appt.id} className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3 text-sm">
                    <span className="font-display text-lg tabular-nums">{formatTime(item.appt.startsAt)}</span>
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <span className={`size-2 rounded-full ${STATUS_DOT[item.appt.status]}`} aria-hidden />
                        {item.appt.clientName}
                      </p>
                      <p className="text-muted">
                        {item.appt.service.name} · hasta {formatTime(item.appt.endsAt)} · {formatPrice(item.appt.price)}
                        {showBarber && ` · con ${item.appt.barber.name}`}
                      </p>
                      <p className="text-xs text-muted">
                        {STATUS_LABEL[item.appt.status]} · {item.appt.code} · +{item.appt.clientPhone}
                        {item.appt.attendance === "ASISTIO" && " · Vino"}
                        {item.appt.attendance === "NO_VINO" && " · No vino"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={clientWhatsapp(item.appt)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-2" aria-label={`WhatsApp a ${item.appt.clientName}`}>
                      <MessageCircle className="size-4" aria-hidden />
                    </a>
                    {item.appt.status === "CONFIRMADO" && hasStarted(item.appt) ? (
                      <>
                        <ActionButton
                          url={`/api/panel/turnos/${item.appt.id}`}
                          body={{ action: "attendance", attendance: item.appt.attendance === "ASISTIO" ? null : "ASISTIO" }}
                          className={`${item.appt.attendance === "ASISTIO" ? "btn-primary" : "btn-ghost"} px-3 py-2 text-sm`}
                        >
                          Vino
                        </ActionButton>
                        <ActionButton
                          url={`/api/panel/turnos/${item.appt.id}`}
                          body={{ action: "attendance", attendance: item.appt.attendance === "NO_VINO" ? null : "NO_VINO" }}
                          className={`${item.appt.attendance === "NO_VINO" ? "btn-danger bg-bad/15" : "btn-ghost"} px-3 py-2 text-sm`}
                        >
                          No vino
                        </ActionButton>
                      </>
                    ) : (
                      <ActionButton
                        url={`/api/panel/turnos/${item.appt.id}`}
                        body={{ action: "cancel" }}
                        className="btn-danger px-3 py-2 text-sm"
                        confirmText="¿Cancelar turno?"
                      >
                        Cancelar
                      </ActionButton>
                    )}
                  </div>
                </li>
              ) : (
                <li key={item.block.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
                  <p>
                    <span className="font-display text-lg tabular-nums">{formatTime(item.block.startsAt)}</span>{" "}
                    <span className="text-muted">
                      a {formatTime(item.block.endsAt)} · Bloqueado{showBarber && ` (${item.block.barber.name})`}
                      {item.block.reason ? ` · ${item.block.reason}` : ""}
                    </span>
                  </p>
                  <ActionButton url={`/api/panel/bloqueos/${item.block.id}`} method="DELETE" className="btn-ghost px-3 py-2 text-sm">
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
                  {formatTime(a.startsAt)} · {a.clientName} · {a.service.name}
                  {showBarber && ` · ${a.barber.name}`} · {a.cancelReason ? CANCEL_REASON_LABEL[a.cancelReason] : "Cancelado"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {!times ? (
        <p className="card text-sm text-muted">Ese día el local está cerrado: no hay horarios para bloquear.</p>
      ) : blockable.length > 0 ? (
        <BlockForm key={date} date={date} times={times} barbers={blockable.map(({ id, name }) => ({ id, name }))} allowAll={isAdmin} />
      ) : (
        isAdmin && (
          <p className="card text-sm text-muted">
            Todavía no cargaste barberos.{" "}
            <Link href="/panel/configuracion" className="text-ink underline underline-offset-2">
              Agregalos en Configuración
            </Link>{" "}
            para empezar a recibir turnos.
          </p>
        )
      )}
    </div>
  );
}
