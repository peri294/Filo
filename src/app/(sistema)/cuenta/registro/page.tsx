import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import { safeReturnTo } from "@/lib/return-to";
import { RegisterForm } from "@/components/auth-forms";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({
  title: "Crear cuenta",
  description: "Creá tu cuenta para reservar turnos.",
  noIndex: true,
});

export default async function RegistroPage({ searchParams }: PageProps<"/cuenta/registro">) {
  const volver = safeReturnTo((await searchParams).volver, "/cuenta");
  if (await getCurrentClient()) redirect(volver);
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted">Te mandamos un código por SMS para verificar tu celular.</p>
      </div>
      <RegisterForm redirectTo={volver} loginHref={`/cuenta/ingresar?volver=${encodeURIComponent(volver)}`} />
    </div>
  );
}
