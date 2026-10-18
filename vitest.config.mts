import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/test-db";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ["tests/global-setup.ts"],
    // Los tests de base comparten prisma/test.db: un archivo por vez.
    fileParallelism: false,
  },
});
