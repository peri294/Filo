import { z } from "zod";
import { registerClient } from "@/lib/auth";
import { handleSameSite } from "@/lib/http";

const schema = z.object({
  phone: z.string().min(1).max(30),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 números"),
  name: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre")
    .max(60, "El nombre es demasiado largo")
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, "Usá solo letras en el nombre"),
  password: z.string().max(200),
  acceptTerms: z.boolean(),
});

export async function POST(request: Request) {
  return handleSameSite(request, async () => {
    await registerClient(schema.parse(await request.json()));
  });
}
