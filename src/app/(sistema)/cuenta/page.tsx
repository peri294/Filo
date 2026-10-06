import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight } from "lucide-react";
import { getCurrentClient } from "@/lib/auth";
import { listClientAppointments } from "@/lib/booking";
import { CANCEL_REASON_LABEL, STATUS_LABEL } from "@/lib/format";
import { formatLongDate, formatTime } from "@/lib/time";
import { LogoutButton } from "@/components/auth-forms";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({ title: "Mis turnos", description: "Tus turnos en todas las barberías.", noIndex: true });

const STATUS_STYLE: Record<string, string> = {
  CONFIRMADO: "text-ok",
  PENDIENTE_WHATSAPP: "text-warn",
  PENDIENTE_PAGO: "text-warn",
  CANCELADO: "text-bad",
};

type Item = Awaited<ReturnType<typeof listClientAppointments>>["upcoming"][number];

function AppointmentRow({ a }: { a: Item }) {
  return (
    <li>
      <Link
        href={`/${a.tenant.slug}/turno/${a.accessToken}`}
        className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 transition hover:bg-line"
      >
        <span className="min-w-0 text-sm">
          <span className="block font-medium">
            {a.tenant.name} · {a.service.name}
          </span>
          <span className="block text-muted first-letter:uppercase">
            {formatLongDate(a.startsAt)} {formatTime(a.startsAt)} · con {a.barber.name}
          </span>
          <span className={`block text-xs ${STATUS_STYLE[a.status]}`}>
            {a.status === "CANCELADO" && a.cancelReason ? CANCEL_REASON_LABEL[a.cancelReason] : STATUS_LABEL[a.status]}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default async function CuentaPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/cuenta/ingresar");
  const { upcoming, past } = await listClientAppointments(client.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl uppercase">Mis turnos</h1>
          <p className="text-sm text-muted">
            {client.name} · +{client.phone}
          </p>
        </div>
        <LogoutButton endpoint="/api/cuenta/salir" redirectTo="/" />
      </div>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-4 text-brass" aria-hidden /> Próximos
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No tenés turnos próximos. Entrá a la página de tu barbería para reservar.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Anteriores</h2>
          <ul className="space-y-2">
            {past.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
