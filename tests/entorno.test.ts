import { describe, expect, it } from "vitest";
import { crearDemo, urlDeMigraciones } from "../prisma/entorno";

const POOLER = "postgresql://u:c@ep-x-pooler.sa-east-1.aws.neon.tech/neondb";
const DIRECTA = "postgresql://u:c@ep-x.sa-east-1.aws.neon.tech/neondb";

describe("entorno", () => {
  it("[001-CA-4] en Vercel no se crea la barbería demo", () => {
    expect(crearDemo({ VERCEL: "1" })).toBe(false);
    expect(crearDemo({ NODE_ENV: "production" })).toBe(false);
    expect(crearDemo({})).toBe(true);
  });

  it("[001-CA-5] las migraciones usan la URL directa si existe", () => {
    expect(urlDeMigraciones({ DATABASE_URL: POOLER, DATABASE_URL_UNPOOLED: DIRECTA })).toBe(DIRECTA);
    expect(urlDeMigraciones({ DATABASE_URL: DIRECTA })).toBe(DIRECTA);
  });
});
