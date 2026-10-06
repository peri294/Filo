import { bookableDates } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { formatLongDate, formatShortDay, zonedInstant } from "@/lib/time";
import { BookingWizard } from "@/components/booking-wizard";
import { getSalon, pageMetadata } from "../seo";

export async function generateMetadata() {
  const { salonName } = await getSalon();
  return pageMetadata({
    title: "Reservar turno",
    description: `Elegí servicio, día y horario en ${salonName}. Pagás en efectivo en el local.`,
  });
}

export default async function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  const { servicio } = await searchParams;
  const [settings, services] = await Promise.all([
    getSalon(),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const dates = bookableDates(settings).map((key) => ({
    key,
    label: formatShortDay(key),
    longLabel: formatLongDate(zonedInstant(key, "12:00")),
  }));
  const preselected = services.find((s) => String(s.id) === servicio)?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Reservar turno</h1>
        <p className="mt-1 text-sm text-muted">Son 5 pasos cortos. No hace falta crear cuenta.</p>
      </div>
      <BookingWizard
        services={services.map(({ id, name, price, durationMin }) => ({ id, name, price, durationMin }))}
        dates={dates}
        initialServiceId={preselected}
      />
    </div>
  );
}
