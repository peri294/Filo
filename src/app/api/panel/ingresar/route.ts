import { z } from "zod";
import { loginStaff } from "@/lib/auth";
import { BookingError } from "@/lib/errors";
import { clientIp, handleSameSite } from "@/lib/http";

const schema = z.object({ phone: z.string().max(30), password: z.string().max(200) });

export async function POST(request: Request) {
  return handleSameSite(request, async () => {
    const { phone, password } = schema.parse(await request.json());
    const error = await loginStaff(phone, password, clientIp(request));
    if (error) throw new BookingError(401, error);
  });
}
