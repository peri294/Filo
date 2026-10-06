import { markClientNotified } from "@/lib/booking";
import { handleClient } from "@/lib/http";

export async function POST(request: Request, ctx: RouteContext<"/api/cuenta/turnos/[token]/notify">) {
  const { token } = await ctx.params;
  return handleClient(request, (client) => markClientNotified(client.id, token));
}
