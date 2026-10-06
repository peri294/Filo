import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/db";
import { listServicesForAdmin } from "@/lib/admin-config";
import { AdminLogin, LogoutButton } from "@/components/admin-controls";
import { ServicesEditor, SettingsForm } from "@/components/admin-config-forms";

export const metadata = { title: "Configuración · Panel del barbero", robots: { index: false } };

export default async function AdminConfigPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const [settings, services] = await Promise.all([getSettings(), listServicesForAdmin()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="btn-ghost px-3 py-2" aria-label="Volver al panel">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <h1 className="font-display text-3xl uppercase">Configuración</h1>
        </div>
        <LogoutButton />
      </div>

      <SettingsForm
        settings={{
          salonName: settings.salonName,
          salonAddress: settings.salonAddress,
          salonPhone: settings.salonPhone,
          openingTime: settings.openingTime,
          closingTime: settings.closingTime,
          daysOpen: settings.daysOpen,
          slotDurationMin: settings.slotDurationMin,
          bookingWindowDays: settings.bookingWindowDays,
          minNoticeMin: settings.minNoticeMin,
        }}
      />

      <ServicesEditor
        unit={settings.slotDurationMin}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price: s.price,
          durationMin: s.durationMin,
          sortOrder: s.sortOrder,
          active: s.active,
          appointmentCount: s._count.appointments,
        }))}
      />
    </div>
  );
}
