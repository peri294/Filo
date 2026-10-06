import { cancelByClient } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function POST(_request: Request, ctx: RouteContext<"/api/appointments/[token]/cancel">) {
  const { token } = await ctx.params;
  return handle(() => cancelByClient(token));
}
