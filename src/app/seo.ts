import { cache } from "react";
import type { Metadata } from "next";
import { getSettings } from "@/lib/db";

/** Una sola lectura de la configuración por request, aunque la pidan el layout, la página y la metadata. */
export const getSalon = cache(getSettings);

// La imagen la genera `opengraph-image.tsx`. Next solo la agrega sola en la raíz: en las demás páginas,
// como `openGraph` se pisa entero, hay que nombrarla.
const shareImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "Turnos online de la barbería" };

/**
 * Metadata de una página pública. Next mezcla `openGraph` de forma superficial (el de la página pisa
 * al del layout), así que acá se arma completo cada vez.
 */
export async function pageMetadata({
  title,
  description,
  noIndex = false,
}: {
  title?: string;
  description: string;
  noIndex?: boolean;
}): Promise<Metadata> {
  const { salonName } = await getSalon();
  const fullTitle = title ? `${title} · ${salonName}` : `${salonName} · Turnos online`;
  return {
    ...(title ? { title } : {}),
    description,
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: salonName,
      title: fullTitle,
      description,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [shareImage] },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
