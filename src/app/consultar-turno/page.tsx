import { LookupForm } from "@/components/lookup-form";
import { pageMetadata } from "../seo";

export function generateMetadata() {
  return pageMetadata({
    title: "Mi turno",
    description: "Buscá tu turno con el código de reserva y tu WhatsApp para verlo, confirmarlo o cancelarlo.",
  });
}

export default function ConsultarTurnoPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Mi turno</h1>
        <p className="mt-2 text-sm text-muted">
          Ingresá el código que te dimos al reservar y el WhatsApp que usaste.
        </p>
      </div>
      <LookupForm />
    </div>
  );
}
