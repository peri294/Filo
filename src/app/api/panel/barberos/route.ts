import { barberSchema, createBarber } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

export async function POST(request: Request) {
  return handleStaff(request, ["ADMIN"], async (user) => {
    await createBarber(staffTenant(user), user, barberSchema.parse(await request.json()));
  });
}
