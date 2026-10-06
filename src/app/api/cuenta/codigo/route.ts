import { z } from "zod";
import { clientIp, handleSameSite } from "@/lib/http";
import { requestCode } from "@/lib/otp";

const schema = z.object({
  phone: z.string().min(1, "Ingresá tu celular").max(30),
  purpose: z.enum(["SIGNUP", "RESET"]),
});

/** Pide un código por SMS para registrarse o recuperar la clave (siempre responde igual). */
export async function POST(request: Request) {
  return handleSameSite(request, async () => {
    const { phone, purpose } = schema.parse(await request.json());
    await requestCode(phone, purpose === "SIGNUP" ? "SIGNUP" : "RESET_CLIENT", clientIp(request));
  });
}
