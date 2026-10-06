import { markClientNotified } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function POST(_request: Request, ctx: RouteContext<"/api/appointments/[token]/notify">) {
  const { token } = await ctx.params;
  return handle(() => markClientNotified(token));
}
