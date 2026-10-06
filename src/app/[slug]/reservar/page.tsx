import { notFound, redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import { activeBarbers, bookableDates } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { findTenantBySlug } from "@/lib/tenant";
import { formatLongDate, formatShortDay, zonedInstant } from "@/lib/time";
import { BookingWizard } from "@/components/booking-wizard";
import { pageMetadata } from "../../seo";

export async function generateMetadata({ params }: PageProps<"/[slug]/reservar">) {
  const tenant = await findTenantBySlug((await params).slug);
  if (!tenant) return {};
  return pageMetadata({
    title: "Reservar turno",
    siteName: tenant.name,
    description: `Elegí servicio, barbero, día y horario en ${tenant.name}.`,
  });
}

export default async function ReservarPage({ params, searchParams }: PageProps<"/[slug]/reservar">) {
  const [{ slug }, { servicio }] = await Promise.all([params, searchParams]);
  const tenant = await findTenantBySlug(slug);
  if (!tenant) notFound();

  // Para reservar hace falta la cuenta: se vuelve acá después de ingresar o registrarse.
  const client = await getCurrentClient();
  if (!client) {
    const back = `/${slug}/reservar${typeof servicio === "string" ? `?servicio=${servicio}` : ""}`;
    redirect(`/cuenta/ingresar?volver=${encodeURIComponent(back)}`);
  }

  const [services, barbers] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" } }),
    activeBarbers(tenant.id),
  ]);
  const dates = bookableDates(tenant).map((key) => ({
    key,
    label: formatShortDay(key),
    longLabel: formatLongDate(zonedInstant(key, "12:00")),
  }));
  const preselected = services.find((s) => String(s.id) === servicio)?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Reservar turno</h1>
        <p className="mt-1 text-sm text-muted">Hola, {client.name.split(" ")[0]}. Son unos pasos cortos.</p>
      </div>
      {barbers.length === 0 || services.length === 0 ? (
        <p className="card text-sm text-muted">Esta barbería todavía no tiene turnos disponibles para reservar.</p>
      ) : (
        <BookingWizard
          slug={tenant.slug}
          services={services.map(({ id, name, price, durationMin }) => ({ id, name, price, durationMin }))}
          barbers={barbers.map(({ id, name }) => ({ id, name }))}
          dates={dates}
          initialServiceId={preselected}
          client={{ name: client.name, phone: `+${client.phone}` }}
        />
      )}
    </div>
  );
}
