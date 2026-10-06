import { logout } from "@/lib/admin-auth";
import { handleSameSite } from "@/lib/http";

export async function POST(request: Request) {
  return handleSameSite(request, () => logout());
}
