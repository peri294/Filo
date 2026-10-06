import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentStaff } from "@/lib/auth";
import { listBarbersForAdmin, listServicesForAdmin } from "@/lib/admin-config";
import { ServicesEditor, SettingsForm } from "@/components/admin-config-forms";
import { BarbersEditor } from "@/components/barbers-editor";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({ title: "Configuración", description: "Configuración de la barbería.", noIndex: true });

export default async function ConfigPage() {
  const user = await getCurrentStaff();
  // Solo el admin de una barbería activa configura; el resto vuelve al panel.
  if (!user || user.role !== "ADMIN" || !user.tenant?.active) redirect("/panel");
  const tenant = user.tenant;
  const [services, barbers] = await Promise.all([listServicesForAdmin(tenant), listBarbersForAdmin(tenant)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/panel" className="btn-ghost px-3 py-2" aria-label="Volver al panel">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-3xl uppercase">Configuración</h1>
          <p className="text-sm text-muted">
            Página pública:{" "}
            <Link href={`/${tenant.slug}`} className="text-ink underline underline-offset-2">
              /{tenant.slug}
            </Link>
          </p>
        </div>
      </div>

      <SettingsForm
        settings={{
          name: tenant.name,
          address: tenant.address,
          whatsapp: tenant.whatsapp,
          weeklyHours: tenant.weeklyHours,
          slotDurationMin: tenant.slotDurationMin,
          bookingWindowDays: tenant.bookingWindowDays,
          minNoticeMin: tenant.minNoticeMin,
        }}
      />

      <BarbersEditor
        unit={tenant.slotDurationMin}
        localHours={tenant.weeklyHours}
        canAddMe={!user.barberId}
        barbers={barbers.map((b) => ({
          id: b.id,
          name: b.name,
          weeklyHours: b.weeklyHours,
          sortOrder: b.sortOrder,
          active: b.active,
          appointmentCount: b._count.appointments,
          user: b.user ? { phone: b.user.phone, role: b.user.role, active: b.user.active } : null,
          isMe: b.id === user.barberId,
        }))}
      />

      <ServicesEditor
        unit={tenant.slotDurationMin}
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
