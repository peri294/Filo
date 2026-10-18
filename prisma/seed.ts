import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizePhone } from "../src/lib/format";
import { hashPassword } from "../src/lib/passwords";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const services = [
  { name: "Corte clásico", description: "Corte a tijera o máquina, lavado y peinado.", price: 12000, durationMin: 30 },
  {
    name: "Corte + Barba",
    description: "Corte completo más perfilado y arreglo de barba.",
    price: 17000,
    durationMin: 60,
  },
  { name: "Perfilado de barba", description: "Perfilado con navaja y toalla caliente.", price: 8000, durationMin: 30 },
  { name: "Corte infantil", description: "Para chicos hasta 12 años.", price: 10000, durationMin: 30 },
];

async function upsertStaff(
  phone: string,
  password: string,
  data: { name: string; role: string; tenantId?: string; barberId?: string },
) {
  const existing = await prisma.staffUser.findUnique({ where: { phone } });
  if (existing) return existing;
  return prisma.staffUser.create({ data: { phone, passwordHash: await hashPassword(password), ...data } });
}

async function main() {
  // Superadmin: el dueño del sistema. Sale del .env para no dejar credenciales en el código.
  const superPhone = normalizePhone(process.env.SUPERADMIN_PHONE ?? "");
  const superPassword = process.env.SUPERADMIN_PASSWORD;
  if (superPhone && superPassword) {
    await upsertStaff(superPhone, superPassword, { name: "Superadmin", role: "SUPERADMIN" });
  } else {
    console.warn("Sin SUPERADMIN_PHONE / SUPERADMIN_PASSWORD en .env: no se creó el superadmin.");
  }

  // Barbería de demo para desarrollo.
  if (process.env.NODE_ENV === "production") return;
  if (await prisma.tenant.findUnique({ where: { slug: "demo" } })) return;

  const tenant = await prisma.tenant.create({
    data: { slug: "demo", name: "Barbería Demo", address: "Av. Corrientes 1234, CABA", whatsapp: "5491100000000" },
  });
  await prisma.service.createMany({ data: services.map((s, i) => ({ ...s, sortOrder: i, tenantId: tenant.id })) });
  const juan = await prisma.barber.create({ data: { tenantId: tenant.id, name: "Juan", sortOrder: 0 } });
  // Lucas no trabaja los lunes y los sábados sale temprano.
  const lucas = await prisma.barber.create({
    data: {
      tenantId: tenant.id,
      name: "Lucas",
      sortOrder: 1,
      weeklyHours: JSON.stringify({
        2: ["09:00", "20:00"],
        3: ["09:00", "20:00"],
        4: ["09:00", "20:00"],
        5: ["09:00", "20:00"],
        6: ["09:00", "14:00"],
      }),
    },
  });
  // Claves de demo, solo para desarrollo.
  await upsertStaff("5491111111111", "demo-admin-1", {
    name: "Juan (admin)",
    role: "ADMIN",
    tenantId: tenant.id,
    barberId: juan.id,
  });
  await upsertStaff("5491122222222", "demo-barbero-1", {
    name: "Lucas",
    role: "BARBER",
    tenantId: tenant.id,
    barberId: lucas.id,
  });
  if (!(await prisma.client.findUnique({ where: { phone: "5491133333333" } }))) {
    const now = new Date();
    await prisma.client.create({
      data: {
        phone: "5491133333333",
        name: "Cliente Demo",
        passwordHash: await hashPassword("demo-cliente-1"),
        phoneVerifiedAt: now,
        acceptedTermsAt: now,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
