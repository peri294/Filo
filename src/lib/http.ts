import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClient, requireStaff, type CurrentClient, type CurrentStaff, type StaffRole } from "@/lib/auth";
import { BookingError } from "@/lib/errors";

/**
 * IP del cliente. En Vercel, `x-real-ip` lo pone la plataforma y no se puede falsificar.
 * Fuera de Vercel se toma el último valor de `x-forwarded-for`, que agrega el proxy (o Next)
 * más cercano; el primero lo puede escribir el propio cliente.
 */
export function clientIp(request: Request) {
  if (process.env.VERCEL) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  const hops = request.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean);
  return hops?.at(-1) || "desconocida";
}

/** Rechaza pedidos que vienen desde otro sitio (protección CSRF de las rutas con cookie). */
function isCrossSite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false; // Los navegadores siempre mandan Origin en POST/PUT/PATCH/DELETE.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
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

/** Para rutas que crean o usan una sesión (login, registro, logout): solo desde el mismo sitio. */
export async function handleSameSite(request: Request, fn: () => Promise<unknown>) {
  if (request.method !== "GET" && isCrossSite(request)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  return handle(fn);
}

/** Rutas del panel: personal logueado con alguno de los roles indicados. */
export async function handleStaff(request: Request, roles: StaffRole[], fn: (user: CurrentStaff) => Promise<unknown>) {
  return handleSameSite(request, async () => fn(await requireStaff(roles)));
}

/** Rutas de la cuenta del cliente. */
export async function handleClient(request: Request, fn: (client: CurrentClient) => Promise<unknown>) {
  return handleSameSite(request, async () => fn(await requireClient()));
}

/** Barbería del usuario del panel (el superadmin no tiene). */
export function staffTenant(user: CurrentStaff) {
  if (!user.tenant) throw new BookingError(403, "Tu usuario no pertenece a una barbería");
  return user.tenant;
}
