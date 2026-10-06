import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { findTenantBySlug } from "@/lib/tenant";
import { navCtaClass, navLinkClass, SiteShell } from "@/components/site-shell";
import { StatusScreen } from "@/components/status-screen";

/** Páginas públicas de una barbería (turnos.com/<slug>). */
export default async function TenantLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await findTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <SiteShell
      title={tenant.name}
      homeHref={`/${tenant.slug}`}
      nav={
        <>
          <Link href="/cuenta" className={navLinkClass}>
            Mis turnos
          </Link>
          {tenant.active && (
            <Link href={`/${tenant.slug}/reservar`} className={navCtaClass}>
              Reservar
            </Link>
          )}
        </>
      }
      footer={
        <>
          {tenant.name} · Turnos online con{" "}
          <Link href="/" className="underline underline-offset-2">
            {BRAND_NAME}
          </Link>
        </>
      }
    >
      {tenant.active ? (
        children
      ) : (
        <StatusScreen icon={Store} eyebrow="No disponible" title={`${tenant.name} no está tomando turnos online`}>
          <p>Por el momento las reservas están pausadas. Comunicate directamente con la barbería.</p>
        </StatusScreen>
      )}
    </SiteShell>
  );
}
