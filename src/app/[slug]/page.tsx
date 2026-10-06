import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, ChevronRight, Clock, ListChecks, MapPin, Users } from "lucide-react";
import { activeBarbers } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { describeWeek } from "@/lib/schedule";
import { findTenantBySlug } from "@/lib/tenant";
import { pageMetadata } from "../seo";

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const tenant = await findTenantBySlug((await params).slug);
  if (!tenant) return {};
  return pageMetadata({
    siteName: tenant.name,
    description: `Reservá tu turno en ${tenant.name}: elegí el servicio, el barbero y el horario.`,
  });
}

export default async function TenantHome({ params }: PageProps<"/[slug]">) {
  const tenant = await findTenantBySlug((await params).slug);
  if (!tenant) notFound();
  const [services, barbers] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" } }),
    activeBarbers(tenant.id),
  ]);
  const base = `/${tenant.slug}`;

  return (
    <div className="space-y-10">
      <section className="pt-6 text-center">
        <p className="text-sm tracking-[0.3em] text-brass uppercase">Barbería</p>
        <h1 className="mt-2 font-display text-4xl uppercase sm:text-6xl">{tenant.name}</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Elegí el servicio, con quién y el horario. Reservás en un minuto.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <Link href={`${base}/reservar`} className="btn-primary">
            <CalendarCheck className="size-5" aria-hidden /> Reservar turno
          </Link>
          <Link href="/cuenta" className="btn-ghost">
            <ListChecks className="size-5" aria-hidden /> Mis turnos
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase">Servicios</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Tocá un servicio para reservarlo.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`${base}/reservar?servicio=${s.id}`}
                className="card flex h-full flex-col gap-2 transition hover:border-brass/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="font-semibold whitespace-nowrap text-brass">{formatPrice(s.price)}</span>
                </div>
                {s.description && <p className="text-sm text-muted">{s.description}</p>}
                <p className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {s.durationMin} min
                  </span>
                  <span className="flex items-center font-semibold text-brass">
                    Reservar <ChevronRight className="size-4" aria-hidden />
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Horarios, equipo y dirección" className="card grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <ul>
            {describeWeek(tenant.weeklyHours).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {barbers.length > 0 && (
          <p className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
            <span>Atienden: {barbers.map((b) => b.name).join(", ")}</span>
          </p>
        )}
        {tenant.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden /> {tenant.address}
          </p>
        )}
      </section>
    </div>
  );
}
