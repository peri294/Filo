import { z } from "zod";
import { deleteService, servicePatchSchema, updateService } from "@/lib/admin-config";
import { handleAdmin } from "@/lib/http";

const idSchema = z.coerce.number({ error: "Servicio inválido" }).int("Servicio inválido").positive("Servicio inválido");

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/services/[id]">) {
  const { id } = await ctx.params;
  return handleAdmin(request, async () => {
    const input = servicePatchSchema.parse(await request.json());
    return updateService(idSchema.parse(id), input);
  });
}

/** Solo borra servicios sin turnos; si tiene turnos responde 409 y hay que desactivarlo. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/services/[id]">) {
  const { id } = await ctx.params;
  return handleAdmin(request, () => deleteService(idSchema.parse(id)));
}
