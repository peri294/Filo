"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle, Timer } from "lucide-react";

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : null;
}

export function TicketActions({
  token,
  status,
  expiresAt,
  notified,
  canCancel,
  cancelHours,
  confirmLink,
  contactLink,
}: {
  token: string;
  status: string;
  expiresAt: string | null;
  notified: boolean;
  canCancel: boolean;
  cancelHours: number;
  confirmLink: string;
  contactLink: string;
}) {
  const router = useRouter();
  const awaitingClient = status === "PENDIENTE_WHATSAPP" && !notified;
  const remaining = useCountdown(awaitingClient ? expiresAt : null);
  const [busy, setBusy] = useState<"notify" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = remaining === 0;
  useEffect(() => {
    // Al vencer, el servidor libera el turno: recargamos para mostrar el estado real.
    if (expired) router.refresh();
  }, [expired, router]);

  async function call(action: "notify" | "cancel") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/appointments/${token}/${action}`, { method: "POST" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Ocurrió un error");
    setBusy(null);
    setConfirmCancel(false);
    router.refresh();
  }

  const mm = remaining !== null ? String(Math.floor(remaining / 60000)).padStart(2, "0") : "";
  const ss = remaining !== null ? String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0") : "";

  return (
    <div className="space-y-4">
      {awaitingClient && (
        <section className="card space-y-4 border-warn/40">
          <div className="flex items-center gap-3">
            <Timer className="size-6 shrink-0 text-warn" aria-hidden />
            <p className="text-sm">
              Tu horario está reservado por{" "}
              <span className="font-display text-xl text-warn tabular-nums" suppressHydrationWarning>
                {mm}:{ss}
              </span>
              . Confirmalo por WhatsApp antes de que venza o se libera.
            </p>
          </div>
          <a href={confirmLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full">
            <MessageCircle className="size-5" aria-hidden /> Enviar WhatsApp al barbero para confirmar
          </a>
          <button type="button" className="btn-ghost w-full" disabled={busy !== null || expired} onClick={() => call("notify")}>
            {busy === "notify" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Ya envié el mensaje
          </button>
        </section>
      )}

      {status === "PENDIENTE_WHATSAPP" && notified && (
        <section className="card flex items-start gap-3 border-ok/30">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <p className="text-sm">
            Recibimos tu aviso. El horario queda reservado mientras el barbero confirma tu turno; te va a contestar por
            WhatsApp.
          </p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">¿No podés ir?</h2>
        {canCancel ? (
          confirmCancel ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">¿Seguro que querés cancelar el turno? El horario se libera para otra persona.</p>
              <div className="flex gap-2">
                <button type="button" className="btn-danger flex-1" disabled={busy !== null} onClick={() => call("cancel")}>
                  {busy === "cancel" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Sí, cancelar
                </button>
                <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmCancel(false)}>
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">Podés cancelar desde acá hasta {cancelHours} horas antes del turno.</p>
              <button type="button" className="btn-danger w-full" onClick={() => setConfirmCancel(true)}>
                Cancelar turno
              </button>
            </>
          )
        ) : (
          <>
            <p className="text-sm text-muted">
              Faltan menos de {cancelHours} horas para tu turno, así que no se puede cancelar desde la web. Escribile al
              barbero para avisarle.
            </p>
            <a href={contactLink} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
              <MessageCircle className="size-5" aria-hidden /> Escribir al barbero
            </a>
          </>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
