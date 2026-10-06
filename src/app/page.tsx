import Link from "next/link";
import { CalendarCheck, ChevronRight, Clock, MapPin, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSalon, pageMetadata } from "./seo";

export async function generateMetadata() {
  const { salonName } = await getSalon();
  return pageMetadata({
    description: `Reservá tu turno en ${salonName}: elegí el servicio, mirá los horarios libres y listo. Sin crear cuenta.`,
  });
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function describeDays(daysOpen: string) {
  const days = daysOpen.split(",").map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const isRange = days.every((d, i) => i === 0 || ((days[i - 1] + 1) % 7) === d);
  if (days.length > 2 && isRange) return `${DAY_NAMES[days[0]]} a ${DAY_NAMES[days[days.length - 1]]}`;
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

export default async function Home() {
  const [settings, services] = await Promise.all([
    getSalon(),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-10">
      <section className="pt-6 text-center">
        <p className="text-sm tracking-[0.3em] text-brass uppercase">Barbería</p>
        <h1 className="mt-2 font-display text-4xl uppercase sm:text-6xl">{settings.salonName}</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Elegí el servicio, mirá los horarios libres y reservá en un minuto. Sin crear cuenta.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <Link href="/reservar" className="btn-primary">
            <CalendarCheck className="size-5" aria-hidden /> Reservar turno
          </Link>
          <Link href="/consultar-turno" className="btn-ghost">
            <Search className="size-5" aria-hidden /> Consultar mi turno
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
                href={`/reservar?servicio=${s.id}`}
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

      <section aria-label="Horarios y dirección" className="card grid gap-3 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-brass" aria-hidden />
          {describeDays(settings.daysOpen)} · {settings.openingTime} a {settings.closingTime}
        </p>
        {settings.salonAddress && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-brass" aria-hidden /> {settings.salonAddress}
          </p>
        )}
      </section>
    </div>
  );
}
