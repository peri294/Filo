"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
    const res = await fetch("/api/appointments/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/turno/${data.token}`);
    } else {
      setError(data.error ?? "Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label htmlFor="code" className="label">Código de turno</label>
        <input
          id="code"
          className="input uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="TURN-XXXXXX"
          autoCapitalize="characters"
          required
        />
      </div>
      <div>
        <label htmlFor="phone" className="label">Teléfono</label>
        <input
          id="phone"
          className="input"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
        Buscar turno
      </button>
    </form>
  );
}
