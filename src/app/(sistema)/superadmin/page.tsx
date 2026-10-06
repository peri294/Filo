import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentStaff } from "@/lib/auth";
import { listTenants } from "@/lib/superadmin";
import { ActionButton } from "@/components/admin-controls";
import { LogoutButton } from "@/components/auth-forms";
import { CreateTenantForm, ResetAdminPassword } from "@/components/superadmin-forms";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({ title: "Superadmin", description: "Administración de barberías.", noIndex: true });

export default async function SuperadminPage() {
  const user = await getCurrentStaff();
  if (!user || user.role !== "SUPERADMIN") redirect("/panel");
  const tenants = await listTenants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl uppercase">Barberías</h1>
          <p className="text-sm text-muted">{tenants.length} en el sistema</p>
        </div>
        <LogoutButton endpoint="/api/panel/salir" redirectTo="/panel" />
      </div>

      <CreateTenantForm />

      <section className="card space-y-3">
        <h2 className="font-semibold">Todas</h2>
        {tenants.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay barberías.</p>
        ) : (
          <ul className="space-y-2">
            {tenants.map((t) => {
              const admin = t.staff[0];
              return (
                <li key={t.id} className={`space-y-3 rounded-xl bg-surface-2 p-3 ${t.active ? "" : "opacity-70"}`}>
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t.name}
                      {!t.active && <span className="rounded-full border border-bad/50 px-2 py-0.5 text-xs text-bad">Suspendida</span>}
                    </p>
                    <p className="text-muted">
                      /{t.slug} · {t._count.barbers} barberos · {t._count.appointments} turnos
                    </p>
                    <p className="text-xs text-muted">
                      Admin: {admin ? `${admin.name} (+${admin.phone})` : "sin admin"} · WhatsApp +{t.whatsapp}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/${t.slug}`} target="_blank" className="btn-ghost px-3 py-2 text-sm">
                      <ExternalLink className="size-4" aria-hidden /> Ver
                    </Link>
                    <ActionButton
                      url={`/api/superadmin/barberias/${t.id}`}
                      method="PATCH"
                      body={{ active: !t.active }}
                      className={t.active ? "btn-danger px-3 py-2 text-sm" : "btn-primary px-3 py-2 text-sm"}
                      confirmText={t.active ? "¿Suspender?" : undefined}
                    >
                      {t.active ? "Suspender" : "Reactivar"}
                    </ActionButton>
                    {admin && <ResetAdminPassword tenantId={t.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
