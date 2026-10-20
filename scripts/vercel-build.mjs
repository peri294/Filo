// Build de Vercel (vercel.json → `npm run vercel-build`). En producción, antes de compilar, aplica las migraciones y da de alta
// el superadmin con las variables de Vercel (el seed no crea la barbería demo ahí: prisma/entorno.ts). Los previews
// de los PR solo compilan, sin tocar ninguna base.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
}
run("npx next build");
