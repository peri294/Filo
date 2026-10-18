"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Llama a la API del panel. Devuelve el mensaje de error, o null si salió bien. */
export async function request(url: string, method = "POST", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return ((await res.json().catch(() => ({}))).error as string) ?? "Ocurrió un error";
  return null;
}

/** Botón que llama a la API y refresca la página. Con confirmText pide un segundo clic. */
export function ActionButton({
  url,
  method = "POST",
  body,
  className,
  confirmText,
  children,
}: {
  url: string;
  method?: string;
  body?: unknown;
  className?: string;
  confirmText?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmText && !armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    const err = await request(url, method, body);
    setBusy(false);
    setArmed(false);
    if (err) setError(err);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-1">
        <button type="button" className={className} disabled={busy} onClick={run}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {armed ? confirmText : children}
        </button>
        {armed && !busy && (
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setArmed(false)}>
            No
          </button>
        )}
      </span>
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
    </span>
  );
}

/** Bloquear un horario. `barbers` son los que el usuario puede bloquear; el admin además tiene "Todos". */
export function BlockForm({
  date,
  times,
  barbers,
  allowAll,
}: {
  date: string;
  times: string[];
  barbers: { id: string; name: string }[];
  allowAll: boolean;
}) {
  const router = useRouter();
  const [barberId, setBarberId] = useState(allowAll ? "any" : (barbers[0]?.id ?? ""));
  const [from, setFrom] = useState(times[0]);
  const [to, setTo] = useState(times[times.length - 1]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await request("/api/panel/bloqueos", "POST", { barberId, date, from, to, reason: reason || undefined });
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setReason("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-semibold">Bloquear horario</h2>
      <p className="text-sm text-muted">Los horarios bloqueados no se pueden reservar desde la web.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(allowAll || barbers.length > 1) && (
          <div className="col-span-2 sm:col-span-4">
            <label htmlFor="block-barber" className="label">
              Barbero
            </label>
            <select id="block-barber" className="input" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              {allowAll && <option value="any">Todos (cierra el local)</option>}
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="from" className="label">
            Desde
          </label>
          <select id="from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {times.slice(0, -1).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="to" className="label">
            Hasta
          </label>
          <select id="to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {times.slice(1).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="reason" className="label">
            Motivo (opcional)
          </label>
          <input
            id="reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={100}
            placeholder="Almuerzo, trámite…"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <button type="submit" className="btn-ghost w-full sm:w-auto" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Bloquear
      </button>
    </form>
  );
}
