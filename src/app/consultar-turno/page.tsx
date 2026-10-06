import { LookupForm } from "@/components/lookup-form";

export default function ConsultarTurnoPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Mi turno</h1>
        <p className="mt-2 text-sm text-muted">
          Ingresá el código que recibiste al reservar (por ejemplo TURN-K7P2QX) y el teléfono que usaste.
        </p>
      </div>
      <LookupForm />
    </div>
  );
}
