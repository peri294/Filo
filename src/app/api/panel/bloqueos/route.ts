import { z } from "zod";
import { createBlock } from "@/lib/booking";
import { handleStaff, staffTenant } from "@/lib/http";

const schema = z.object({
  barberId: z.string().min(1).max(40),
  date: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  return handleStaff(request, ["ADMIN", "BARBER"], async (user) => {
    await createBlock(user, staffTenant(user), schema.parse(await request.json()));
  });
}
