import { z } from "zod";
import { deleteService, servicePatchSchema, updateService } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

const idSchema = z.coerce.number({ error: "Servicio inválido" }).int().positive("Servicio inválido");

export async function PATCH(request: Request, ctx: RouteContext<"/api/panel/servicios/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN"], async (user) => {
    await updateService(staffTenant(user), idSchema.parse(id), servicePatchSchema.parse(await request.json()));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/panel/servicios/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN"], (user) => deleteService(staffTenant(user), idSchema.parse(id)));
}
