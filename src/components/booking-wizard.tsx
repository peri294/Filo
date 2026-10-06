"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, Loader2, Pencil, RotateCcw, Shuffle } from "lucide-react";
import { formatPrice } from "@/lib/format";

type Service = { id: number; name: string; price: number; durationMin: number };
type DateOption = { key: string; label: string; longLabel: string };
type Slot = { time: string; available: boolean };
type Barber = { id: string; name: string };
type StepId = "paso-servicio" | "paso-barbero" | "paso-dia" | "paso-horario" | "paso-confirmar";

/** "El primero disponible" (mismo valor que ANY_BARBER en src/lib/booking.ts). */
const ANY = "any";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Ocurrió un error"), { status: res.status });
  return data;
}

/** Lleva la pantalla al paso indicado, suave salvo que el usuario prefiera menos movimiento. */
function scrollToStep(id: StepId) {
  // Esperamos un frame para que React pinte el contenido nuevo (por ejemplo, los horarios).
  requestAnimationFrame(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}

function Step({
  id,
  n,
  title,
  done,
  children,
}: {
  id: StepId;
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="card space-y-4">
      <h2 id={`${id}-titulo`} className="flex items-center gap-3 font-semibold">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-sm ${
            done ? "bg-ok text-black" : "bg-brass text-black"
          }`}
          aria-hidden
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <span>
          <span className="sr-only">Paso {n}: </span>
          {title}
          {done && <span className="sr-only"> (listo)</span>}
        </span>
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  missing,
  onFix,
}: {
  label: string;
  value: React.ReactNode;
  missing?: string;
  onFix?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">
        {missing ? (
          <button type="button" onClick={onFix} className="rounded text-warn underline underline-offset-2">
            {missing}
          </button>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function BookingWizard({
  slug,
  services,
  barbers,
  dates,
  initialServiceId,
  client,
}: {
  slug: string;
  services: Service[];
  barbers: Barber[];
  dates: DateOption[];
  initialServiceId: number | null;
  client: { name: string; phone: string };
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState<number | null>(initialServiceId);
  // Si el servicio vino elegido desde el inicio, lo mostramos resumido con opción de cambiarlo.
  const [showServiceList, setShowServiceList] = useState(initialServiceId === null);
  const [barberId, setBarberId] = useState(ANY);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const firstServiceRef = useRef<HTMLButtonElement>(null);

  const service = services.find((s) => s.id === serviceId);
  const dateOption = dates.find((d) => d.key === date);
  const barber = barbers.find((b) => b.id === barberId);
  // Con un solo barbero no hace falta elegir: el paso no se muestra.
  const showBarbers = barbers.length > 1;
  const stepN = (step: StepId) =>
    (["paso-servicio", "paso-barbero", "paso-dia", "paso-horario", "paso-confirmar"] as StepId[])
      .filter((id) => showBarbers || id !== "paso-barbero")
      .indexOf(step) + 1;

  async function loadSlots(nextServiceId: number | null, nextDate: string | null, nextBarber = barberId) {
    setTime(null);
    setSlots(null);
    setSlotsError(false);
    if (!nextServiceId || !nextDate) return;
    const id = ++requestId.current;
    setSlotsLoading(true);
    try {
      const params = new URLSearchParams({ date: nextDate, serviceId: String(nextServiceId), barberId: nextBarber });
      const res = await fetch(`/api/${slug}/availability?${params}`);
      const data = await res.json();
      if (id !== requestId.current) return; // llegó una respuesta vieja
      if (res.ok) setSlots(data.slots);
      else setSlotsError(true);
    } catch {
      if (id === requestId.current) setSlotsError(true);
    } finally {
      if (id === requestId.current) setSlotsLoading(false);
    }
  }

  function chooseService(id: number) {
    setServiceId(id);
    loadSlots(id, date);
    scrollToStep(date ? "paso-horario" : showBarbers ? "paso-barbero" : "paso-dia");
  }

  function chooseBarber(id: string) {
    setBarberId(id);
    loadSlots(serviceId, date, id);
    scrollToStep(date ? "paso-horario" : "paso-dia");
  }

  function chooseDate(key: string) {
    setDate(key);
    loadSlots(serviceId, key);
    scrollToStep(serviceId ? "paso-horario" : "paso-servicio");
  }

  function chooseTime(t: string) {
    setTime(t);
    scrollToStep("paso-confirmar");
  }

  function openServiceList() {
    setShowServiceList(true);
    requestAnimationFrame(() => firstServiceRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !date || !time) return;

    setSubmitting(true);
    setError(null);
    try {
      const { token } = await postJson(`/api/${slug}/appointments`, {
        serviceId,
        date,
        time,
        barberId,
        paymentMethod: "EFECTIVO",
      });
      router.push(`/${slug}/turno/${token}?nueva=1`);
      // No liberamos el botón: queda "Reservando…" hasta que carga el comprobante.
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(
        e.status ? e.message : "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.",
      );
      if (e.status === 401) {
        router.push(`/cuenta/ingresar?volver=${encodeURIComponent(`/${slug}/reservar`)}`);
        return;
      }
      if (e.status === 409) {
        loadSlots(serviceId, date);
        scrollToStep("paso-horario");
      }
      setSubmitting(false);
    }
  }

  const availableCount = slots?.filter((s) => s.available).length ?? 0;
  const missing = [!service && "el servicio", !date && "el día", !time && "el horario"].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Step id="paso-servicio" n={stepN("paso-servicio")} title="Elegí el servicio" done={!!service}>
        {!showServiceList && service ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass bg-brass/10 p-3">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-brass uppercase">Elegiste</p>
              <p className="font-medium">{service.name}</p>
              <p className="text-sm text-muted">
                {formatPrice(service.price)} · {service.durationMin} min
              </p>
            </div>
            <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={openServiceList}>
              <Pencil className="size-4" aria-hidden /> Cambiar
              <span className="sr-only"> servicio</span>
            </button>
          </div>
        ) : (
          <div role="group" aria-labelledby="paso-servicio-titulo" className="grid gap-2 sm:grid-cols-2">
            {services.map((s, i) => {
              const selected = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  ref={i === 0 ? firstServiceRef : undefined}
                  type="button"
                  onClick={() => chooseService(s.id)}
                  aria-pressed={selected}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? "border-brass bg-brass/10" : "border-line hover:border-muted"
                  }`}
                >
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="text-sm text-muted">
                      {formatPrice(s.price)} · {s.durationMin} min
                    </span>
                  </span>
                  {selected && <Check className="size-5 shrink-0 text-brass" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </Step>

      {showBarbers && (
        <Step id="paso-barbero" n={stepN("paso-barbero")} title="Elegí con quién" done>
          <div role="group" aria-labelledby="paso-barbero-titulo" className="grid gap-2 sm:grid-cols-2">
            {[{ id: ANY, name: "El primero disponible" }, ...barbers].map((b) => {
              const selected = b.id === barberId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => chooseBarber(b.id)}
                  aria-pressed={selected}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? "border-brass bg-brass/10" : "border-line hover:border-muted"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {b.id === ANY && <Shuffle className="size-4 text-brass" aria-hidden />}
                    {b.name}
                  </span>
                  {selected && <Check className="size-5 shrink-0 text-brass" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="hint">Con &quot;El primero disponible&quot; ves los horarios de todos y te asignamos a quien esté libre.</p>
        </Step>
      )}

      <Step id="paso-dia" n={stepN("paso-dia")} title="Elegí el día" done={!!date}>
        <div
          role="group"
          aria-labelledby="paso-dia-titulo"
          className="-mx-1 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-2"
        >
          {dates.map((d, i) => {
            const selected = d.key === date;
            const parts = d.label.replace(".", "").split(" ");
            const dayNumber = parts.pop();
            const month = Number(d.key.slice(5, 7)) - 1;
            const showMonth = i === 0 || d.key.endsWith("-01") || dates[i - 1].key.slice(5, 7) !== d.key.slice(5, 7);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => chooseDate(d.key)}
                aria-pressed={selected}
                aria-label={d.longLabel}
                className={`flex min-w-16 shrink-0 snap-start flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                  selected ? "border-brass bg-brass text-black" : "border-line hover:border-muted"
                }`}
              >
                <span className={`text-xs capitalize ${selected ? "" : "text-muted"}`}>{parts.join(" ")}</span>
                <span className="text-lg leading-tight font-semibold tabular-nums">{dayNumber}</span>
                <span className={`text-[0.7rem] uppercase ${selected ? "" : "text-muted"} ${showMonth ? "" : "invisible"}`}>
                  {MONTHS[month]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted sm:hidden" aria-hidden>
          Deslizá para ver más días →
        </p>
      </Step>

      <Step id="paso-horario" n={stepN("paso-horario")} title="Elegí el horario" done={!!time}>
        <div aria-live="polite" className="text-sm text-muted empty:hidden">
          {!serviceId || !date ? (
            <p>Primero elegí {!serviceId ? "el servicio" : "el día"}.</p>
          ) : slotsLoading ? (
            <p className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando horarios…
            </p>
          ) : slotsError ? (
            <div className="space-y-3">
              <p role="alert" className="text-bad">
                No pudimos cargar los horarios.
              </p>
              <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => loadSlots(serviceId, date)}>
                <RotateCcw className="size-4" aria-hidden /> Reintentar
              </button>
            </div>
          ) : slots && availableCount === 0 ? (
            <p>No quedan horarios libres ese día. Probá con otro.</p>
          ) : slots ? (
            <p className="first-letter:uppercase">
              {dateOption?.longLabel}: {availableCount} {availableCount === 1 ? "horario libre" : "horarios libres"}.
            </p>
          ) : null}
        </div>
        {!slotsLoading && slots && availableCount > 0 && (
          <div role="group" aria-labelledby="paso-horario-titulo" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => {
              const selected = s.time === time;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => chooseTime(s.time)}
                  aria-pressed={s.available ? selected : undefined}
                  aria-label={s.available ? undefined : `${s.time}, ocupado`}
                  className={`rounded-lg border py-2.5 text-sm tabular-nums transition ${
                    !s.available
                      ? "border-transparent bg-surface-2 text-muted/50 line-through"
                      : selected
                        ? "border-brass bg-brass font-semibold text-black"
                        : "border-line hover:border-muted"
                  }`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}
      </Step>

      <Step id="paso-confirmar" n={stepN("paso-confirmar")} title="Revisá y confirmá" done={false}>
        <dl className="text-sm">
          <SummaryRow
            label="Servicio"
            value={service?.name}
            missing={service ? undefined : "Elegir servicio"}
            onFix={() => scrollToStep("paso-servicio")}
          />
          {showBarbers && (
            <SummaryRow
              label="Con"
              value={barber?.name ?? "El primero disponible"}
            />
          )}
          <SummaryRow
            label="Día"
            value={<span className="first-letter:uppercase">{dateOption?.longLabel}</span>}
            missing={dateOption ? undefined : "Elegir día"}
            onFix={() => scrollToStep("paso-dia")}
          />
          <SummaryRow
            label="Hora"
            value={time && `${time} hs${service ? ` (${service.durationMin} min)` : ""}`}
            missing={time ? undefined : "Elegir horario"}
            onFix={() => scrollToStep("paso-horario")}
          />
          <SummaryRow label="A nombre de" value={client.name} />
          <SummaryRow label="Celular" value={client.phone} />
          <SummaryRow label="Total" value={service ? formatPrice(service.price) : "—"} />
        </dl>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-muted">Forma de pago</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-brass bg-brass/10 p-3">
              <Banknote className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
              <div>
                <p className="font-medium">
                  Efectivo en el local <span className="sr-only">(elegida)</span>
                </p>
                <p className="text-sm text-muted">Después confirmás por WhatsApp dentro de los 15 minutos.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-line p-3 opacity-50" aria-disabled>
              <CreditCard className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Mercado Pago</p>
                <p className="text-sm text-muted">Próximamente.</p>
              </div>
            </div>
          </div>
        </fieldset>

        <div aria-live="assertive">
          {error && (
            <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>
          )}
        </div>

        {missing.length > 0 && (
          <p id="falta" className="text-sm text-muted">
            Para reservar te falta elegir {missing.join(", ").replace(/, ([^,]*)$/, " y $1")}.
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={missing.length > 0 || submitting}
          aria-describedby={missing.length > 0 ? "falta" : undefined}
        >
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitting ? "Reservando…" : "Confirmar reserva"}
        </button>
      </Step>
    </form>
  );
}
