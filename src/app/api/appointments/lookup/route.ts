import { z } from "zod";
import { lookupAppointment } from "@/lib/booking";
import { handle } from "@/lib/http";

const schema = z.object({ code: z.string().min(1, "Ingresá el código"), phone: z.string().min(1, "Ingresá el teléfono") });

export async function POST(request: Request) {
  return handle(async () => {
    const { code, phone } = schema.parse(await request.json());
    return { token: await lookupAppointment(code, phone) };
  });
}
