"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogOut } from "lucide-react";

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

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await request("/api/admin/login", "POST", { password }));
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-4">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase">
        <Lock className="size-5 text-brass" aria-hidden /> Panel del barbero
      </h1>
      <div>
        <label htmlFor="password" className="label">Clave</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Entrar
      </button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost px-3 py-2 text-sm"
      onClick={async () => {
        await request("/api/admin/logout");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden /> Salir
    </button>
  );
}

export function BlockForm({ date, times }: { date: string; times: string[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(times[0]);
  const [to, setTo] = useState(times[times.length - 1]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await request("/api/admin/blocks", "POST", { date, from, to, reason: reason || undefined });
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
        <div>
          <label htmlFor="from" className="label">Desde</label>
          <select id="from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {times.slice(0, -1).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="to" className="label">Hasta</label>
          <select id="to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {times.slice(1).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="reason" className="label">Motivo (opcional)</label>
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
