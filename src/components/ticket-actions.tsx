"use client";

import { useEffect, useRef, useState } from "react";
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

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{children}</p>;
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
  const [error, setError] = useState<{ action: "notify" | "cancel"; message: string } | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const confirmShown = useRef(false);

  const expired = remaining === 0;
  useEffect(() => {
    // Al vencer, el servidor libera el turno: recargamos para mostrar el estado real.
    if (expired) router.refresh();
  }, [expired, router]);

  // Al abrir o cerrar la confirmación el botón que tenía el foco desaparece: lo movemos a uno equivalente.
  useEffect(() => {
    if (confirmCancel) keepButtonRef.current?.focus();
    else if (confirmShown.current) cancelButtonRef.current?.focus();
    confirmShown.current = confirmCancel;
  }, [confirmCancel]);

  async function call(action: "notify" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${token}/${action}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError({ action, message: data.error ?? "Ocurrió un error. Probá de nuevo." });
      }
    } catch {
      setError({ action, message: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." });
    }
    setBusy(null);
    setConfirmCancel(false);
    router.refresh();
  }

  const mm = remaining !== null ? String(Math.floor(remaining / 60000)).padStart(2, "0") : "";
  const ss = remaining !== null ? String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0") : "";
  const expiresAtLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : "";

  return (
    <div className="space-y-4">
      {awaitingClient && (
        <section className="card space-y-4 border-warn/40" aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="font-semibold">
            Confirmá tu turno por WhatsApp
          </h2>
          <div className="flex items-center gap-3">
            <Timer className="size-6 shrink-0 text-warn" aria-hidden />
            <p className="text-sm">
              Te guardamos el horario por{" "}
              <span className="font-display text-xl text-warn tabular-nums" aria-hidden suppressHydrationWarning>
                {mm}:{ss}
              </span>
              <span className="sr-only" suppressHydrationWarning>
                unos minutos, hasta las {expiresAtLabel}
              </span>
              . Si no lo confirmás, se libera.
            </p>
          </div>
          <a href={confirmLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full">
            <MessageCircle className="size-5 shrink-0" aria-hidden /> Confirmar por WhatsApp
            <span className="sr-only"> (se abre WhatsApp)</span>
          </a>
          <p className="text-xs text-muted">Después de mandar el mensaje, avisanos acá:</p>
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy !== null || expired}
            onClick={() => call("notify")}
          >
            {busy === "notify" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Ya envié el mensaje
          </button>
          <div aria-live="assertive">{error?.action === "notify" && <ErrorMessage>{error.message}</ErrorMessage>}</div>
        </section>
      )}

      {status === "PENDIENTE_WHATSAPP" && notified && (
        <section className="card flex items-start gap-3 border-ok/30" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <p className="text-sm">
            Recibimos tu aviso. Guardamos tu horario unas horas para que el barbero lo confirme por WhatsApp. Si
            no te responde, volvé a escribirle.
          </p>
        </section>
      )}

      <section className="card space-y-3" aria-labelledby="cancel-title">
        <h2 id="cancel-title" className="font-semibold">
          ¿No podés ir?
        </h2>
        {canCancel ? (
          confirmCancel ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">¿Seguro? Si cancelás, el horario queda libre para otra persona.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-danger flex-1"
                  disabled={busy !== null}
                  onClick={() => call("cancel")}
                >
                  {busy === "cancel" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Sí, cancelar
                </button>
                <button
                  ref={keepButtonRef}
                  type="button"
                  className="btn-ghost flex-1"
                  disabled={busy !== null}
                  onClick={() => setConfirmCancel(false)}
                >
                  No, mantener turno
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">Podés cancelar desde acá hasta {cancelHours} horas antes.</p>
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn-danger w-full"
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar turno
              </button>
            </>
          )
        ) : (
          <>
            <p className="text-sm text-muted">
              Faltan menos de {cancelHours} horas, así que ya no se puede cancelar desde la web. Avisale al barbero
              por WhatsApp.
            </p>
            <a href={contactLink} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
              <MessageCircle className="size-5 shrink-0" aria-hidden /> Escribir al barbero
              <span className="sr-only"> (se abre WhatsApp)</span>
            </a>
          </>
        )}
        <div aria-live="assertive">{error?.action === "cancel" && <ErrorMessage>{error.message}</ErrorMessage>}</div>
      </section>
    </div>
  );
}
