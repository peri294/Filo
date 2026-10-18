import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({
  title: "Política de privacidad",
  description: `Cómo usa ${BRAND_NAME} tus datos.`,
});

// BORRADOR: este texto es una base y tiene que revisarlo un abogado antes de publicar el sitio.
export default function PrivacidadPage() {
  return (
    <article className="card space-y-4 text-sm leading-relaxed">
      <h1 className="font-display text-3xl uppercase">Política de privacidad</h1>
      <p className="text-muted">Última actualización: octubre de 2026.</p>
      <h2 className="font-semibold">Qué datos guardamos</h2>
      <p>
        Tu nombre, tu celular, tu contraseña (cifrada, nunca en texto) y tus turnos: barbería, servicio, barbero, fecha,
        estado y asistencia. También guardamos la dirección IP desde la que reservás, para prevenir abusos.
      </p>
      <h2 className="font-semibold">Para qué los usamos</h2>
      <p>
        Para gestionar tus reservas, verificar tu celular, permitirte recuperar la contraseña y prevenir abusos. Cada
        barbería donde reservás ve tus datos y tus turnos con ella, y puede usarlos para estadísticas de su negocio.
      </p>
      <h2 className="font-semibold">Con quién los compartimos</h2>
      <p>
        Solo con las barberías donde reservás y con los proveedores que necesitamos para funcionar (hosting, base de
        datos y envío de SMS). No vendemos tus datos.
      </p>
      <h2 className="font-semibold">Tus derechos</h2>
      <p>
        Según la Ley 25.326 de Protección de Datos Personales podés pedir acceso, rectificación o eliminación de tus
        datos. La Agencia de Acceso a la Información Pública es el órgano de control de la ley.
      </p>
    </article>
  );
}
