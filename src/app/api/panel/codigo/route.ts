import { z } from "zod";
import { clientIp, handleSameSite } from "@/lib/http";
import { requestCode } from "@/lib/otp";

const schema = z.object({ phone: z.string().min(1, "Ingresá tu celular").max(30) });

/** Código por SMS para que el personal recupere su clave (siempre responde igual). */
export async function POST(request: Request) {
  return handleSameSite(request, async () => {
    const { phone } = schema.parse(await request.json());
    await requestCode(phone, "RESET_STAFF", clientIp(request));
  });
}
