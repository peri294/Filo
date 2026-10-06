import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { navLinkClass, SiteShell } from "@/components/site-shell";

/** Páginas de la plataforma: inicio, cuenta del cliente, panel y superadmin. */
export default function SistemaLayout({ children }: LayoutProps<"/">) {
  return (
    <SiteShell
      title={BRAND_NAME}
      homeHref="/"
      nav={
        <>
          <Link href="/cuenta" className={navLinkClass}>
            Mis turnos
          </Link>
          <Link href="/panel" className={navLinkClass}>
            Panel
          </Link>
        </>
      }
      footer={
        <>
          {BRAND_NAME} ·{" "}
          <Link href="/terminos" className="underline underline-offset-2">
            Términos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            Privacidad
          </Link>
        </>
      }
    >
      {children}
    </SiteShell>
  );
}
