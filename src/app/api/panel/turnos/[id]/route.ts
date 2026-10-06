import { z } from "zod";
import { adminCancel, adminConfirm, adminReject, markAttendance } from "@/lib/booking";
import { handleStaff } from "@/lib/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["confirm", "reject", "cancel"]) }),
  z.object({ action: z.literal("attendance"), attendance: z.enum(["ASISTIO", "NO_VINO"]).nullable() }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/panel/turnos/[id]">) {
  const { id } = await ctx.params;
  return handleStaff(request, ["ADMIN", "BARBER"], async (user) => {
    const input = schema.parse(await request.json());
    if (input.action === "attendance") return markAttendance(user, id, input.attendance);
    const actions = { confirm: adminConfirm, reject: adminReject, cancel: adminCancel };
    await actions[input.action](user, id);
  });
}
