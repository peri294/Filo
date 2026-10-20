import "dotenv/config";
import { defineConfig } from "prisma/config";
import { urlDeMigraciones } from "./prisma/entorno";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: urlDeMigraciones(process.env),
  },
});
