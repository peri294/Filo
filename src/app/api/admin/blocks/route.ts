import { z } from "zod";
import { createBlock } from "@/lib/booking";
import { handleAdmin } from "@/lib/http";

const schema = z.object({
  date: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  return handleAdmin(async () => {
    const { date, from, to, reason } = schema.parse(await request.json());
    await createBlock(date, from, to, reason);
  });
}
