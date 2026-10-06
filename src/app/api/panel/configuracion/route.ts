import { settingsSchema, updateSettings } from "@/lib/admin-config";
import { handleStaff, staffTenant } from "@/lib/http";

export async function PUT(request: Request) {
  return handleStaff(request, ["ADMIN"], async (user) => {
    await updateSettings(staffTenant(user), settingsSchema.parse(await request.json()));
  });
}
