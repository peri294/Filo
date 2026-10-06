import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError } from "@/lib/booking";
import { isAdmin } from "@/lib/admin-auth";

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "desconocida";
}

export function errorResponse(e: unknown) {
  if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Ocurrió un error inesperado" }, { status: 500 });
}

/** Ejecuta el handler y convierte los errores en respuestas JSON. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return NextResponse.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleAdmin(fn: () => Promise<unknown>) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return handle(fn);
}
