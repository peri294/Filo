import { z } from "zod";
import { login } from "@/lib/admin-auth";
import { BookingError } from "@/lib/booking";
import { clientIp, handle } from "@/lib/http";

const schema = z.object({ password: z.string() });

export async function POST(request: Request) {
  return handle(async () => {
    const { password } = schema.parse(await request.json());
    const error = await login(password, clientIp(request));
    if (error) throw new BookingError(401, error);
  });
}
