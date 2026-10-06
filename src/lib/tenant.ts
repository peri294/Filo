import { cache } from "react";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/errors";

/**
 * Único lugar donde se decide qué barbería corresponde a un pedido.
 * Hoy sale del primer tramo de la URL (turnos.com/<slug>). Para sumar subdominios o dominios
 * propios, se traduce el host a un slug en proxy.ts y todo lo demás queda igual.
 */

/** Rutas propias del sistema: no pueden ser el slug de una barbería. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "cuenta",
  "panel",
  "superadmin",
  "terminos",
  "privacidad",
  "turno",
  "turnos",
  "login",
  "_next",
  "icon.svg",
  "apple-icon",
  "favicon.ico",
  "opengraph-image",
  "robots.txt",
  "sitemap.xml",
]);

/** Minúsculas, números y guiones; de 3 a 40 caracteres; sin guion al principio ni al final. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function isValidSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Barbería por slug (activa o suspendida), o null. Cacheada por pedido. */
export const findTenantBySlug = cache(async (slug: string) => {
  if (!isValidSlug(slug)) return null;
  return prisma.tenant.findUnique({ where: { slug } });
});

/** Barbería que puede recibir reservas; si no existe o está suspendida, tira el error correspondiente. */
export async function requireActiveTenant(slug: string) {
  const tenant = await findTenantBySlug(slug);
  if (!tenant) throw new BookingError(404, "No encontramos esa barbería");
  if (!tenant.active) throw new BookingError(403, "Esta barbería no está tomando turnos online por el momento");
  return tenant;
}
