import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, CalendarDays, CheckCircle2, Clock, Scissors, User } from "lucide-react";
import { canSelfCancel, getAppointmentByToken, SELF_CANCEL_MIN_HOURS } from "@/lib/booking";
import { CANCEL_REASON_LABEL, formatPrice, STATUS_LABEL, whatsappLink } from "@/lib/format";
import { formatLongDate, formatTime } from "@/lib/time";
import { CopyButton } from "@/components/copy-button";
import { TicketActions } from "@/components/ticket-actions";
import { getSalon, pageMetadata } from "../../seo";

const STATUS_STYLE: Record<string, string> = {
  CONFIRMADO: "bg-ok/15 text-ok",
  PENDIENTE_WHATSAPP: "bg-warn/15 text-warn",
  PENDIENTE_PAGO: "bg-warn/15 text-warn",
  CANCELADO: "bg-bad/15 text-bad",
};

// La metadata y la página piden el mismo turno: una sola consulta por request.
const findAppointment = cache(getAppointmentByToken);

// El comprobante es privado: no se indexa ni se muestran datos del turno en la vista previa del link.
export async function generateMetadata({ params }: PageProps<"/turno/[token]">) {
  const { token } = await params;
  const exists = (await findAppointment(token)) !== null;
  return pageMetadata({
    title: exists ? "Tu turno" : "Turno no encontrado",
    description: "Comprobante de tu turno: estado, día y horario.",
    noIndex: true,
  });
}

export default async function TurnoPage({ params, searchParams }: PageProps<"/turno/[token]">) {
  const [{ token }, { nueva }] = await Promise.all([params, searchParams]);
  const [appt, settings] = await Promise.all([findAppointment(token), getSalon()]);
  if (!appt) notFound();

  const day = formatLongDate(appt.startsAt);
  const hour = formatTime(appt.startsAt);
  const confirmText =
    `Hola! Quiero confirmar mi turno ${appt.code}: ${appt.service.name} el ${day} a las ${hour}. ` +
    `A nombre de ${appt.clientName}. Pago en efectivo en el local.`;
  const contactText = `Hola! Te escribo por mi turno ${appt.code} del ${day} a las ${hour}.`;
  const justBooked = nueva === "1" && appt.status !== "CANCELADO";
  const firstName = appt.clientName.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {justBooked && (
        <p className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <span>
            ¡Listo, {firstName}! Tu horario quedó reservado.
            {appt.status === "PENDIENTE_WHATSAPP" && " Falta un paso: confirmalo por WhatsApp."}
          </span>
        </p>
      )}

      <section className="card space-y-5" aria-labelledby="ticket-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="ticket-title" className="font-display text-3xl uppercase">
            Tu turno
          </h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[appt.status]}`}>
            <span className="sr-only">Estado: </span>
            {STATUS_LABEL[appt.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-muted uppercase">Código</p>
            <p className="font-display text-2xl tracking-wider tabular-nums">{appt.code}</p>
          </div>
          <CopyButton
            text={appt.code}
            label="Copiar código"
            copiedLabel="Código copiado"
            className="btn-ghost px-4 py-2.5 text-sm"
          />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 shrink-0 text-brass" aria-hidden />
            <dt className="sr-only">Servicio</dt>
            <dd>
              {appt.service.name} · {formatPrice(appt.price)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-brass" aria-hidden />
            <dt className="sr-only">Día</dt>
            <dd className="first-letter:uppercase">{day}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-brass" aria-hidden />
            <dt className="sr-only">Hora</dt>
            <dd>{hour} hs</dd>
          </div>
          <div className="flex items-center gap-2">
            <User className="size-4 shrink-0 text-brass" aria-hidden />
            <dt className="sr-only">A nombre de</dt>
            <dd>{appt.clientName}</dd>
          </div>
        </dl>

        {appt.status === "CANCELADO" && appt.cancelReason && (
          <p className="text-sm text-muted">{CANCEL_REASON_LABEL[appt.cancelReason]}.</p>
        )}
      </section>

      {appt.status === "CANCELADO" ? (
        <Link href="/reservar" className="btn-primary w-full">
          Reservar otro turno
        </Link>
      ) : (
        <TicketActions
          token={token}
          status={appt.status}
          expiresAt={appt.expiresAt?.toISOString() ?? null}
          notified={appt.clientNotifiedAt !== null}
          canCancel={canSelfCancel(appt)}
          cancelHours={SELF_CANCEL_MIN_HOURS}
          confirmLink={whatsappLink(settings.salonPhone, confirmText)}
          contactLink={whatsappLink(settings.salonPhone, contactText)}
        />
      )}

      <section className="card space-y-3" aria-labelledby="save-link-title">
        <h2 id="save-link-title" className="flex items-center gap-2 font-semibold">
          <Bookmark className="size-4 shrink-0 text-brass" aria-hidden /> Guardá este link
        </h2>
        <p className="text-sm text-muted">
          Es la forma más rápida de volver a tu turno. Si lo perdés, buscalo en{" "}
          <Link href="/consultar-turno" className="text-ink underline underline-offset-2">
            Mi turno
          </Link>{" "}
          con el código y tu WhatsApp.
        </p>
        <CopyButton label="Copiar link del turno" copiedLabel="Link copiado" className="btn-ghost w-full" />
      </section>
    </div>
  );
}
