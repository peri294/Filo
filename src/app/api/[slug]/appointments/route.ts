import { z } from "zod";
import { createAppointment } from "@/lib/booking";
import { clientIp, handleClient } from "@/lib/http";
import { requireActiveTenant } from "@/lib/tenant";

const schema = z.object({
  serviceId: z.number().int().positive(),
  date: z.string(),
  time: z.string(),
  barberId: z.string().min(1).max(40),
  paymentMethod: z.enum(["EFECTIVO", "MERCADOPAGO"]),
});

export async function POST(request: Request, ctx: RouteContext<"/api/[slug]/appointments">) {
  const { slug } = await ctx.params;
  return handleClient(request, async (client) => {
    const tenant = await requireActiveTenant(slug);
    const input = schema.parse(await request.json());
    const appt = await createAppointment(tenant, client, input, clientIp(request));
    return { token: appt.accessToken };
  });
}
