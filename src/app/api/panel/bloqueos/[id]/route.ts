import { deleteBlock } from "@/lib/booking";
import { handleStaff } from "@/lib/http";

export async function DELETE(request: Request, ctx: RouteContext<"/api/panel/bloqueos/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN", "BARBER"], (user) => deleteBlock(user, id));
}
