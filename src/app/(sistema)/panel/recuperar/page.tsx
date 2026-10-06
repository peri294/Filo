import { RecoverForm } from "@/components/auth-forms";
import { pageMetadata } from "../../../seo";

export const metadata = pageMetadata({ title: "Recuperar contraseña del panel", description: "Recuperá tu contraseña con un código por SMS.", noIndex: true });

export default function PanelRecuperarPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted">
          Te mandamos un código por SMS al celular de tu usuario del panel. Si no te llega, pedile al admin de tu
          barbería que te asigne una clave nueva.
        </p>
      </div>
      <RecoverForm codeEndpoint="/api/panel/codigo" resetEndpoint="/api/panel/recuperar" redirectTo="/panel" />
    </div>
  );
}
