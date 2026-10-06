import { deleteBlock } from "@/lib/booking";
import { handleAdmin } from "@/lib/http";

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/blocks/[id]">) {
  const { id } = await ctx.params;
  return handleAdmin(request, () => deleteBlock(id));
}
