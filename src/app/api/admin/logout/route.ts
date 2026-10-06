import { logout } from "@/lib/admin-auth";
import { handle } from "@/lib/http";

export async function POST() {
  return handle(() => logout());
}
