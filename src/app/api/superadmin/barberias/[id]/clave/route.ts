import { z } from "zod";
import { resetTenantAdminPassword } from "@/lib/superadmin";
import { handleStaff } from "@/lib/http";

const schema = z.object({ password: z.string().max(200) });

/** Plan B: clave nueva para el admin de una barbería que no puede recuperarla por SMS. */
export async function POST(request: Request, ctx: RouteContext<"/api/superadmin/barberias/[id]/clave">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["SUPERADMIN"], async () => {
    await resetTenantAdminPassword(id, schema.parse(await request.json()).password);
  });
}
