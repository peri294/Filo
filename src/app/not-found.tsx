import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Scissors } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <StatusScreen
      icon={Scissors}
      eyebrow="Error 404"
      title="Esta página no existe"
      actions={
        <>
          <Link href="/reservar" className="btn-primary">
            <CalendarCheck className="size-5" aria-hidden /> Reservar turno
          </Link>
          <Link href="/" className="btn-ghost">
            Ir al inicio
          </Link>
        </>
      }
    >
      <p>Puede que el link esté mal escrito o que la página ya no esté.</p>
    </StatusScreen>
  );
}
