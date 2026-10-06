import { z } from "zod";
import { setTenantActive } from "@/lib/superadmin";
import { handleStaff } from "@/lib/http";

const schema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, ctx: RouteContext<"/api/superadmin/barberias/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["SUPERADMIN"], async () => {
    await setTenantActive(id, schema.parse(await request.json()).active);
  });
}
