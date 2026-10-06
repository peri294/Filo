import { getSettings } from "@/lib/db";
import { settingsSchema, updateSettings } from "@/lib/admin-config";
import { handleAdmin } from "@/lib/http";

export async function GET() {
  return handleAdmin(() => getSettings());
}

export async function PUT(request: Request) {
  return handleAdmin(async () => {
    const input = settingsSchema.parse(await request.json());
    await updateSettings(input);
  });
}
