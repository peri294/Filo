import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

// La imagen la genera `opengraph-image.tsx`. Next solo la agrega sola en la raíz: en las demás páginas,
// como `openGraph` se pisa entero, hay que nombrarla.
const shareImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "Turnos online" };

/**
 * Metadata de una página. Next mezcla `openGraph` de forma superficial (el de la página pisa
 * al del layout), así que acá se arma completo cada vez. `siteName` es la barbería o la plataforma.
 */
export function pageMetadata({
  title,
  description,
  siteName = BRAND_NAME,
  noIndex = false,
}: {
  title?: string;
  description: string;
  siteName?: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = title ? `${title} · ${siteName}` : `${siteName} · Turnos online`;
  return {
    title: { absolute: fullTitle },
    description,
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName,
      title: fullTitle,
      description,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [shareImage] },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
