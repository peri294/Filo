import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Scissors, User } from "lucide-react";
import { canSelfCancel, getAppointmentByToken, SELF_CANCEL_MIN_HOURS } from "@/lib/booking";
import { getSettings } from "@/lib/db";
import { CANCEL_REASON_LABEL, formatPrice, STATUS_LABEL, whatsappLink } from "@/lib/format";
import { formatLongDate, formatTime } from "@/lib/time";
import { TicketActions } from "@/components/ticket-actions";

const STATUS_STYLE: Record<string, string> = {
  CONFIRMADO: "bg-ok/15 text-ok",
  PENDIENTE_WHATSAPP: "bg-warn/15 text-warn",
  PENDIENTE_PAGO: "bg-warn/15 text-warn",
  CANCELADO: "bg-bad/15 text-bad",
};

export default async function TurnoPage({ params }: PageProps<"/turno/[token]">) {
  const { token } = await params;
  const [appt, settings] = await Promise.all([getAppointmentByToken(token), getSettings()]);
  if (!appt) notFound();

  const day = formatLongDate(appt.startsAt);
  const hour = formatTime(appt.startsAt);
  const confirmText =
    `Hola! Quiero confirmar mi turno ${appt.code}: ${appt.service.name} el ${day} a las ${hour}. ` +
    `A nombre de ${appt.clientName}. Pago en efectivo en el local.`;
  const contactText = `Hola! Te escribo por mi turno ${appt.code} del ${day} a las ${hour}.`;

  return (
    <div className="space-y-4">
      <div className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-muted uppercase">Código de turno</p>
            <p className="font-display text-2xl tracking-wider">{appt.code}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[appt.status]}`}>
            {STATUS_LABEL[appt.status]}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 text-brass" aria-hidden />
            <dt className="sr-only">Servicio</dt>
            <dd>
              {appt.service.name} · {formatPrice(appt.price)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brass" aria-hidden />
            <dt className="sr-only">Día</dt>
            <dd className="capitalize">{day}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-brass" aria-hidden />
            <dt className="sr-only">Hora</dt>
            <dd>{hour} hs</dd>
          </div>
          <div className="flex items-center gap-2">
            <User className="size-4 text-brass" aria-hidden />
            <dt className="sr-only">Nombre</dt>
            <dd>{appt.clientName}</dd>
          </div>
        </dl>

        {appt.status === "CANCELADO" && appt.cancelReason && (
          <p className="text-sm text-muted">{CANCEL_REASON_LABEL[appt.cancelReason]}.</p>
        )}
      </div>

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

      <p className="text-center text-xs text-muted">
        Guardá este link para volver a ver tu turno. También podés buscarlo en{" "}
        <Link href="/consultar-turno" className="underline">
          Mi turno
        </Link>{" "}
        con el código y tu teléfono.
      </p>
    </div>
  );
}
