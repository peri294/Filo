import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({
  title: "Términos y condiciones",
  description: `Términos de uso de ${BRAND_NAME}.`,
});

// BORRADOR: este texto es una base y tiene que revisarlo un abogado antes de publicar el sitio.
export default function TerminosPage() {
  return (
    <article className="card space-y-4 text-sm leading-relaxed">
      <h1 className="font-display text-3xl uppercase">Términos y condiciones</h1>
      <p className="text-muted">Última actualización: octubre de 2026.</p>
      <h2 className="font-semibold">1. Qué es {BRAND_NAME}</h2>
      <p>
        {BRAND_NAME} es una plataforma para reservar turnos en barberías. Cada barbería es responsable de sus servicios,
        precios, horarios y de la atención que brinda.
      </p>
      <h2 className="font-semibold">2. Tu cuenta</h2>
      <p>
        Para reservar necesitás una cuenta asociada a un celular que verificamos por SMS. Sos responsable de mantener tu
        contraseña en secreto y de los turnos que se reserven con tu cuenta.
      </p>
      <h2 className="font-semibold">3. Reservas, confirmación y cancelación</h2>
      <p>
        Las reservas con pago en efectivo quedan provisorias hasta que la barbería las confirma por WhatsApp. Podés
        cancelar desde la web hasta 24 horas antes del turno; con menos anticipación, tenés que comunicarte con la
        barbería.
      </p>
      <h2 className="font-semibold">4. Uso correcto</h2>
      <p>
        No está permitido reservar turnos que no vayas a usar, usar datos de otras personas ni intentar afectar el
        funcionamiento del sitio. Podemos suspender cuentas que incumplan estas reglas.
      </p>
      <h2 className="font-semibold">5. Cambios</h2>
      <p>Podemos actualizar estos términos. Si el cambio es importante, te lo vamos a avisar.</p>
    </article>
  );
}
