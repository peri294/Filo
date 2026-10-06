"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

export function LookupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/turno/${data.token}`);
        return; // dejamos el botón ocupado hasta que cambie la página
      }
      setError(data.error ?? "Ocurrió un error. Probá de nuevo.");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    }
    setBusy(false);
  }

  const invalid = error ? true : undefined;

  return (
    <form onSubmit={submit} className="card space-y-4" aria-busy={busy}>
      <div>
        <label htmlFor="code" className="label">
          Código de turno
        </label>
        <input
          id="code"
          name="code"
          className="input uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="TURN-K7P2QX"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={invalid}
          aria-describedby={error ? "lookup-error" : "code-hint"}
        />
        <p id="code-hint" className="hint">
          Está en el comprobante de tu reserva.
        </p>
      </div>
      <div>
        <label htmlFor="phone" className="label">
          WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          className="input"
          type="tel"
          inputMode="tel"
          placeholder="11 2345 6789"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          aria-invalid={invalid}
          aria-describedby={error ? "lookup-error" : "phone-hint"}
        />
        <p id="phone-hint" className="hint">
          El mismo número que usaste al reservar.
        </p>
      </div>
      <div aria-live="assertive">
        {error && (
          <p id="lookup-error" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
        {busy ? "Buscando…" : "Buscar turno"}
      </button>
    </form>
  );
}
