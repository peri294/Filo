import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, TicketX } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Turno no encontrado",
  robots: { index: false, follow: false },
};

export default function TurnoNotFound() {
  return (
    <StatusScreen
      icon={TicketX}
      eyebrow="Link inválido"
      title="No encontramos ese turno"
      actions={
        <>
          <Link href="/cuenta" className="btn-primary">
            <ListChecks className="size-5" aria-hidden /> Ver mis turnos
          </Link>
          <Link href="/" className="btn-ghost">
            Ir al inicio
          </Link>
        </>
      }
    >
      <p>Puede que el link esté incompleto: a veces se corta al copiarlo.</p>
      <p>Todos tus turnos están en &quot;Mis turnos&quot;, con tu cuenta.</p>
    </StatusScreen>
  );
}
