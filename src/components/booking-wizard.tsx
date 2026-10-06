"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";

type Service = { id: number; name: string; price: number; durationMin: number };
type DateOption = { key: string; label: string };
type Slot = { time: string; available: boolean };

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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-3 font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-brass text-sm text-black">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BookingWizard({
  services,
  dates,
  initialServiceId,
}: {
  services: Service[];
  dates: DateOption[];
  initialServiceId: number | null;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState<number | null>(initialServiceId);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const service = services.find((s) => s.id === serviceId);

  async function loadSlots(nextServiceId: number | null, nextDate: string | null) {
    setTime(null);
    setSlots(null);
    if (!nextServiceId || !nextDate) return;
    const id = ++requestId.current;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/availability?date=${nextDate}&serviceId=${nextServiceId}`);
      const data = await res.json();
      if (id !== requestId.current) return; // llegó una respuesta vieja
      setSlots(res.ok ? data.slots : []);
    } finally {
      if (id === requestId.current) setSlotsLoading(false);
    }
  }

  function chooseService(id: number) {
    setServiceId(id);
    loadSlots(id, date);
  }

  function chooseDate(key: string) {
    setDate(key);
    loadSlots(serviceId, key);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !date || !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await postJson("/api/appointments", {
        serviceId,
        date,
        time,
        clientName: name,
        clientPhone: phone,
        paymentMethod: "EFECTIVO",
      });
      router.push(`/turno/${token}`);
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(e.message);
      if (e.status === 409) loadSlots(serviceId, date);
      setSubmitting(false);
    }
  }

  const availableCount = slots?.filter((s) => s.available).length ?? 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Step n={1} title="Elegí el servicio">
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => chooseService(s.id)}
              aria-pressed={s.id === serviceId}
              className={`rounded-xl border p-3 text-left transition ${
                s.id === serviceId ? "border-brass bg-brass/10" : "border-line hover:border-muted"
              }`}
            >
              <span className="block font-medium">{s.name}</span>
              <span className="text-sm text-muted">
                {formatPrice(s.price)} · {s.durationMin} min
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Elegí el día">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {dates.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => chooseDate(d.key)}
              aria-pressed={d.key === date}
              className={`min-w-16 shrink-0 rounded-xl border px-3 py-2 text-center text-sm capitalize transition ${
                d.key === date ? "border-brass bg-brass text-black" : "border-line hover:border-muted"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Step>

      <Step n={3} title="Elegí el horario">
        {!serviceId || !date ? (
          <p className="text-sm text-muted">Elegí un servicio y un día para ver los horarios.</p>
        ) : slotsLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando horarios…
          </p>
        ) : availableCount === 0 ? (
          <p className="text-sm text-muted">No quedan horarios libres ese día. Probá con otro.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots!.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                onClick={() => setTime(s.time)}
                aria-pressed={s.time === time}
                className={`rounded-lg border py-2 text-sm tabular-nums transition ${
                  !s.available
                    ? "border-transparent bg-surface-2 text-muted/40 line-through"
                    : s.time === time
                      ? "border-brass bg-brass font-semibold text-black"
                      : "border-line hover:border-muted"
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n={4} title="Tus datos">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Nombre</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          <div>
            <label htmlFor="phone" className="label">WhatsApp</label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="11 2345 6789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </div>
        </div>
      </Step>

      <Step n={5} title="Forma de pago">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-brass bg-brass/10 p-3">
            <Banknote className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
            <div>
              <p className="font-medium">Efectivo en el local</p>
              <p className="text-sm text-muted">Confirmás el turno por WhatsApp dentro de los 15 minutos.</p>
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
      </Step>

      {error && (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {service && time && date ? (
            <>
              <span className="font-semibold text-ink">{service.name}</span> ·{" "}
              <span className="capitalize">{dates.find((d) => d.key === date)?.label}</span> · {time} ·{" "}
              {formatPrice(service.price)}
            </>
          ) : (
            "Completá los pasos para reservar."
          )}
        </p>
        <button type="submit" className="btn-primary" disabled={!service || !time || submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Reservar
        </button>
      </div>
    </form>
  );
}
