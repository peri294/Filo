import { bookableDates } from "@/lib/booking";
import { getSettings, prisma } from "@/lib/db";
import { formatShortDay } from "@/lib/time";
import { BookingWizard } from "@/components/booking-wizard";

export default async function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  const { servicio } = await searchParams;
  const [settings, services] = await Promise.all([
    getSettings(),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const dates = bookableDates(settings).map((key) => ({ key, label: formatShortDay(key) }));
  const preselected = services.find((s) => String(s.id) === servicio)?.id ?? null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl uppercase">Reservar turno</h1>
      <BookingWizard
        services={services.map(({ id, name, price, durationMin }) => ({ id, name, price, durationMin }))}
        dates={dates}
        initialServiceId={preselected}
      />
    </div>
  );
}
