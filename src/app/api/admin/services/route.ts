import { createService, listServicesForAdmin, serviceSchema } from "@/lib/admin-config";
import { handleAdmin } from "@/lib/http";

export async function GET(request: Request) {
  return handleAdmin(request, () => listServicesForAdmin());
}

export async function POST(request: Request) {
  return handleAdmin(request, async () => {
    const input = serviceSchema.parse(await request.json());
    return createService(input);
  });
}
