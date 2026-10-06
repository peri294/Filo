import { z } from "zod";
import { adminCancel, adminConfirm, adminReject } from "@/lib/booking";
import { handleAdmin } from "@/lib/http";

const schema = z.object({ action: z.enum(["confirm", "reject", "cancel"]) });
const actions = { confirm: adminConfirm, reject: adminReject, cancel: adminCancel };

export async function POST(request: Request, ctx: RouteContext<"/api/admin/appointments/[id]">) {
  const { id } = await ctx.params;
  return handleAdmin(async () => {
    const { action } = schema.parse(await request.json());
    await actions[action](id);
  });
}
