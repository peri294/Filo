import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Oswald } from "next/font/google";
import { Scissors } from "lucide-react";
import { getSalon } from "./seo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });

// Todas las páginas leen la agenda en vivo: no se prerenderizan.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0e0e0f",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const { salonName } = await getSalon();
  const title = `${salonName} · Turnos online`;
  const description = `Reservá tu turno en ${salonName} en un minuto, sin crear cuenta.`;
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    title: { default: title, template: `%s · ${salonName}` },
    description,
    applicationName: salonName,
    openGraph: { type: "website", locale: "es_AR", siteName: salonName, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { salonName } = await getSalon();
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#contenido"
          className="sr-only rounded-lg bg-brass px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Saltar al contenido
        </a>
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 rounded-lg font-display text-xl tracking-wide uppercase"
            >
              <Scissors className="size-5 shrink-0 text-brass" aria-hidden />
              <span className="truncate">{salonName}</span>
            </Link>
            <nav aria-label="Principal" className="flex shrink-0 items-center gap-1 text-sm">
              <Link href="/consultar-turno" className="rounded-lg px-3 py-2.5 text-muted hover:text-ink">
                Mi turno
              </Link>
              <Link
                href="/reservar"
                className="rounded-lg bg-brass px-3 py-2.5 font-semibold text-black hover:bg-brass-strong"
              >
                Reservar
              </Link>
            </nav>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 outline-none">
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          {salonName} · Turnos online
        </footer>
      </body>
    </html>
  );
}
