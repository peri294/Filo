import { z } from "zod";
import { prisma } from "@/lib/db";
import { setStaffPassword } from "@/lib/auth";
import { BookingError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { isValidSlug, RESERVED_SLUGS } from "@/lib/tenant";

export const tenantSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre de la barbería").max(80),
  slug: z.string().trim().toLowerCase(),
  whatsapp: z.string().trim().min(1, "Ingresá el WhatsApp del local"),
  adminName: z.string().trim().min(1, "Ingresá el nombre del admin").max(60),
  adminPhone: z.string().trim().min(1, "Ingresá el celular del admin"),
  adminPassword: z.string(),
});

export type TenantInput = z.infer<typeof tenantSchema>;

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      staff: { where: { role: "ADMIN" }, select: { id: true, name: true, phone: true } },
      _count: { select: { barbers: true, appointments: true } },
    },
  });
}

/** Crea la barbería con su admin. El admin después agrega barberos y servicios desde su panel. */
export async function createTenant(input: TenantInput) {
  if (RESERVED_SLUGS.has(input.slug)) throw new BookingError(400, "Esa dirección está reservada por el sistema");
  if (!isValidSlug(input.slug)) {
    throw new BookingError(400, "La dirección solo puede tener minúsculas, números y guiones (de 3 a 40 caracteres)");
  }
  const whatsapp = normalizePhone(input.whatsapp);
  if (!whatsapp) throw new BookingError(400, "WhatsApp del local inválido");
  const adminPhone = normalizePhone(input.adminPhone);
  if (!adminPhone) throw new BookingError(400, "Celular del admin inválido");
  const problem = passwordProblem(input.adminPassword);
  if (problem) throw new BookingError(400, problem);
  if (await prisma.tenant.findUnique({ where: { slug: input.slug } }))
    throw new BookingError(409, "Esa dirección ya está en uso");
  if (await prisma.staffUser.findUnique({ where: { phone: adminPhone } })) {
    throw new BookingError(409, "Ese celular ya tiene un usuario del panel");
  }

  const passwordHash = await hashPassword(input.adminPassword);
  return prisma.tenant.create({
    data: {
      slug: input.slug,
      name: input.name,
      whatsapp,
      staff: { create: { phone: adminPhone, passwordHash, name: input.adminName, role: "ADMIN" } },
    },
  });
}

/** Suspender cierra las sesiones del panel de esa barbería; sus turnos quedan guardados. */
export async function setTenantActive(id: string, active: boolean) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new BookingError(404, "Barbería no encontrada");
  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { active } }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { staffUser: { tenantId: id } } })]),
  ]);
}

/** Plan B si el admin no puede recuperar la clave por SMS. */
export async function resetTenantAdminPassword(tenantId: string, password: string) {
  const admin = await prisma.staffUser.findFirst({ where: { tenantId, role: "ADMIN" } });
  if (!admin) throw new BookingError(404, "Esa barbería no tiene admin");
  await setStaffPassword(admin.id, password);
}
