import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { TEST_DATABASE_URL } from "./test-db";

/** Crea test.db desde cero aplicando las migraciones. No toca dev.db. */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`test.db${suffix}`, { force: true });
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
