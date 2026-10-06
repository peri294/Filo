import { createService, serviceSchema } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

export async function POST(request: Request) {
  return handleStaff(request, ["ADMIN"], async (user) => {
    await createService(staffTenant(user), serviceSchema.parse(await request.json()));
  });
}
