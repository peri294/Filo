import { z } from "zod";
import { resetPassword } from "@/lib/auth";
import { handleSameSite } from "@/lib/http";

const schema = z.object({
  phone: z.string().min(1).max(30),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 números"),
  password: z.string().max(200),
});

export async function POST(request: Request) {
  return handleSameSite(request, async () => {
    const { phone, code, password } = schema.parse(await request.json());
    await resetPassword("CLIENT", phone, code, password);
  });
}
