import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import { safeReturnTo } from "@/lib/return-to";
import { LoginForm } from "@/components/auth-forms";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({
  title: "Ingresar",
  description: "Ingresá para reservar y ver tus turnos.",
  noIndex: true,
});

export default async function IngresarPage({ searchParams }: PageProps<"/cuenta/ingresar">) {
  const volver = safeReturnTo((await searchParams).volver, "/cuenta");
  if (await getCurrentClient()) redirect(volver);
  const query = `?volver=${encodeURIComponent(volver)}`;
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Ingresar</h1>
        <p className="mt-1 text-sm text-muted">Con tu cuenta reservás en cualquier barbería y ves todos tus turnos.</p>
      </div>
      <LoginForm
        endpoint="/api/cuenta/ingresar"
        redirectTo={volver}
        recoverHref={`/cuenta/recuperar${query}`}
        registerHref={`/cuenta/registro${query}`}
      />
    </div>
  );
}
