import { createTenant, tenantSchema } from "@/lib/superadmin";
import { handleStaff } from "@/lib/http";

export async function POST(request: Request) {
  return handleStaff(request, ["SUPERADMIN"], async () => {
    const tenant = await createTenant(tenantSchema.parse(await request.json()));
    return { slug: tenant.slug };
  });
}
