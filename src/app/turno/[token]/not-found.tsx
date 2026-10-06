import type { Metadata } from "next";
import Link from "next/link";
import { Search, TicketX } from "lucide-react";
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
          <Link href="/consultar-turno" className="btn-primary">
            <Search className="size-5" aria-hidden /> Buscar con mi código
          </Link>
          <Link href="/reservar" className="btn-ghost">
            Reservar un turno nuevo
          </Link>
        </>
      }
    >
      <p>Puede que el link esté incompleto: a veces se corta al copiarlo.</p>
      <p>Buscalo con el código (TURN-…) y tu WhatsApp.</p>
    </StatusScreen>
  );
}
