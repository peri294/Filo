import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Oswald } from "next/font/google";
import { Scissors } from "lucide-react";
import { getSettings } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });

// Todas las páginas leen la agenda en vivo: no se prerenderizan.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { salonName } = await getSettings();
  return { title: `${salonName} · Turnos online`, description: `Reservá tu turno en ${salonName}.` };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { salonName } = await getSettings();
  return (
    <html lang="es" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-wide uppercase">
              <Scissors className="size-5 text-brass" aria-hidden />
              {salonName}
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/consultar-turno" className="rounded-lg px-3 py-2 text-muted hover:text-ink">
                Mi turno
              </Link>
              <Link href="/reservar" className="rounded-lg bg-brass px-3 py-2 font-semibold text-black hover:bg-brass-strong">
                Reservar
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          {salonName} · Turnos online
        </footer>
      </body>
    </html>
  );
}
