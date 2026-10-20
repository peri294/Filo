import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/test-db";

// Se valida acá, antes de que corra nada: si apunta a otra base, no se borra ni se toca.
const TEST_DATABASE_URL = testDatabaseUrl(process.env);

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL, DATABASE_URL_UNPOOLED: TEST_DATABASE_URL },
    globalSetup: ["tests/global-setup.ts"],
    // La base de tests puede estar lejos (Neon): cada consulta es una ida y vuelta por la red.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Los tests comparten la base de tests: un archivo por vez.
    fileParallelism: false,
  },
});
