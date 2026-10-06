import { getAvailability } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle(() => getAvailability(params.get("date") ?? "", Number(params.get("serviceId"))));
}
