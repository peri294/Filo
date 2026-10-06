import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Scissors } from "lucide-react";
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
          <Link href="/cuenta" className="btn-primary">
            <ListChecks className="size-5" aria-hidden /> Mis turnos
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
