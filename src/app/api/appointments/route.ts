import { z } from "zod";
import { createAppointment } from "@/lib/booking";
import { normalizePhone } from "@/lib/format";
import { clientIp, handle } from "@/lib/http";

const schema = z.object({
  serviceId: z.number().int().positive(),
  date: z.string(),
  time: z.string(),
  clientName: z.string().trim().min(2, "Ingresá tu nombre").max(60, "El nombre es demasiado largo"),
  clientPhone: z
    .string()
    .refine((p) => normalizePhone(p) !== null, "Ingresá un celular válido con código de área"),
  paymentMethod: z.enum(["EFECTIVO", "MERCADOPAGO"]),
});

export async function POST(request: Request) {
  return handle(async () => {
    const input = schema.parse(await request.json());
    const appt = await createAppointment(input, clientIp(request));
    return { token: appt.accessToken };
  });
}
