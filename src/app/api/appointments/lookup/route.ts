import { z } from "zod";
import { lookupAppointment } from "@/lib/booking";
import { clientIp, handle } from "@/lib/http";

const schema = z.object({
  code: z.string().trim().min(1, "Ingresá el código").max(20, "Código inválido"),
  phone: z.string().min(1, "Ingresá el teléfono").max(30, "Teléfono inválido"),
});

export async function POST(request: Request) {
  return handle(async () => {
    const { code, phone } = schema.parse(await request.json());
    return { token: await lookupAppointment(code, phone, clientIp(request)) };
  });
}
