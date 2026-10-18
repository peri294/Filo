import { safeReturnTo } from "@/lib/return-to";
import { RecoverForm } from "@/components/auth-forms";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({
  title: "Recuperar contraseña",
  description: "Recuperá tu contraseña con un código por SMS.",
  noIndex: true,
});

export default async function RecuperarPage({ searchParams }: PageProps<"/cuenta/recuperar">) {
  const volver = safeReturnTo((await searchParams).volver, "/cuenta");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted">Te mandamos un código por SMS al celular de tu cuenta.</p>
      </div>
      <RecoverForm codeEndpoint="/api/cuenta/codigo" resetEndpoint="/api/cuenta/recuperar" redirectTo={volver} />
    </div>
  );
}
