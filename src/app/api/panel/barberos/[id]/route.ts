import { barberPatchSchema, deleteBarber, updateBarber } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/panel/barberos/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN"], async (user) => {
    await updateBarber(staffTenant(user), id, barberPatchSchema.parse(await request.json()));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/panel/barberos/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN"], (user) => deleteBarber(staffTenant(user), user, id));
}
