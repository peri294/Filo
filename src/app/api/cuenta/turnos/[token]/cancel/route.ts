import { cancelByClient } from "@/lib/booking";
import { handleClient } from "@/lib/http";

export async function POST(request: Request, ctx: RouteContext<"/api/cuenta/turnos/[token]/cancel">) {
  const { token } = await ctx.params;
  return handleClient(request, (client) => cancelByClient(client.id, token));
}
