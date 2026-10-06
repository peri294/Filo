import Link from "next/link";
import { Scissors } from "lucide-react";

/** Encabezado, contenido y pie. Lo usan la plataforma y cada barbería con su nombre y sus links. */
export function SiteShell({
  title,
  homeHref,
  nav,
  footer,
  children,
}: {
  title: string;
  homeHref: string;
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2 rounded-lg font-display text-xl tracking-wide uppercase"
          >
            <Scissors className="size-5 shrink-0 text-brass" aria-hidden />
            <span className="truncate">{title}</span>
          </Link>
          <nav aria-label="Principal" className="flex shrink-0 items-center gap-1 text-sm">
            {nav}
          </nav>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 outline-none">
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">{footer}</footer>
    </>
  );
}

export const navLinkClass = "rounded-lg px-3 py-2.5 text-muted hover:text-ink";
export const navCtaClass = "rounded-lg bg-brass px-3 py-2.5 font-semibold text-black hover:bg-brass-strong";
