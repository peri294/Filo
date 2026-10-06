import { z } from "zod";
import { setBarberLogin } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

const schema = z.object({ phone: z.string().trim().max(30).default(""), password: z.string().max(200) });

/** Crea el usuario del barbero o le asigna una clave nueva. */
export async function POST(request: Request, ctx: RouteContext<"/api/panel/barberos/[id]/acceso">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN"], async (user) => {
    await setBarberLogin(staffTenant(user), id, schema.parse(await request.json()));
  });
}
