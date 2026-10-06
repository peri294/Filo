import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });

// Todas las páginas leen datos en vivo: no se prerenderizan.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0e0e0f",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: `${BRAND_NAME} · Turnos online`, template: `%s · ${BRAND_NAME}` },
  description: "Turnos online para barberías: reservá en un minuto.",
  applicationName: BRAND_NAME,
};

/** Estructura común. El encabezado lo pone cada sección: la plataforma o cada barbería. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#contenido"
          className="sr-only rounded-lg bg-brass px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
