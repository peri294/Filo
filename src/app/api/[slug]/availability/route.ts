import { z } from "zod";
import { getAvailability } from "@/lib/booking";
import { handle } from "@/lib/http";
import { requireActiveTenant } from "@/lib/tenant";

const schema = z.object({
  date: z.string(),
  serviceId: z.coerce.number({ error: "Servicio inválido" }).int("Servicio inválido").positive("Servicio inválido"),
  barberId: z.string().min(1).max(40),
});

export async function GET(request: Request, ctx: RouteContext<"/api/[slug]/availability">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const tenant = await requireActiveTenant(slug);
    const { date, serviceId, barberId } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return getAvailability(tenant, date, serviceId, barberId);
  });
}
