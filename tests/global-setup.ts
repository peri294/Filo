import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Deja la base de tests vacía y le aplica las migraciones. TEST_DATABASE_URL ya la validó vitest.config.mts
 * (testDatabaseUrl): nunca es la de desarrollo ni la de producción.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Falta TEST_DATABASE_URL.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";');
  } finally {
    await client.end();
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
