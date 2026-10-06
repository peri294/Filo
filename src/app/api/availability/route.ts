import { z } from "zod";
import { getAvailability } from "@/lib/booking";
import { handle } from "@/lib/http";

const schema = z.object({
  date: z.string(),
  serviceId: z.coerce.number({ error: "Servicio inválido" }).int("Servicio inválido").positive("Servicio inválido"),
});

export async function GET(request: Request) {
  return handle(async () => {
    const { date, serviceId } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return getAvailability(date, serviceId);
  });
}
