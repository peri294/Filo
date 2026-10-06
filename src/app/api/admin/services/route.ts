import { createService, listServicesForAdmin, serviceSchema } from "@/lib/admin-config";
import { handleAdmin } from "@/lib/http";

export async function GET() {
  return handleAdmin(() => listServicesForAdmin());
}

export async function POST(request: Request) {
  return handleAdmin(async () => {
    const input = serviceSchema.parse(await request.json());
    return createService(input);
  });
}
