import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

const services = [
  { name: "Corte clásico", description: "Corte a tijera o máquina, lavado y peinado.", price: 12000, durationMin: 30 },
  { name: "Corte + Barba", description: "Corte completo más perfilado y arreglo de barba.", price: 17000, durationMin: 60 },
  { name: "Perfilado de barba", description: "Perfilado con navaja y toalla caliente.", price: 8000, durationMin: 30 },
  { name: "Corte infantil", description: "Para chicos hasta 12 años.", price: 10000, durationMin: 30 },
];

async function main() {
  await prisma.businessSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await prisma.service.count()) === 0) {
    await prisma.service.createMany({ data: services.map((s, i) => ({ ...s, sortOrder: i })) });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
