import Link from "next/link";
import { CalendarCheck, LayoutDashboard, ListChecks } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "../seo";

export const metadata = pageMetadata({
  description: "Turnos online para barberías: reservá en un minuto con tu cuenta.",
});

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="pt-6 text-center">
        <p className="text-sm tracking-[0.3em] text-brass uppercase">Turnos online</p>
        <h1 className="mt-2 font-display text-4xl uppercase sm:text-6xl">{BRAND_NAME}</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Reservá en tu barbería en un minuto: elegís servicio, barbero y horario. Todos tus turnos, en una sola cuenta.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarCheck className="size-5 text-brass" aria-hidden /> ¿Querés reservar?
          </h2>
          <p className="text-sm text-muted">
            Entrá al link de tu barbería. Ahí ves los horarios libres y reservás con tu cuenta.
          </p>
          <Link href="/cuenta" className="btn-ghost w-full">
            <ListChecks className="size-5" aria-hidden /> Ver mis turnos
          </Link>
        </div>
        <div className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="size-5 text-brass" aria-hidden /> ¿Tenés una barbería?
          </h2>
          <p className="text-sm text-muted">
            Agenda por barbero, confirmaciones por WhatsApp y métricas de tus clientes.
          </p>
          <Link href="/panel" className="btn-primary w-full">
            Entrar al panel
          </Link>
        </div>
      </section>
    </div>
  );
}
