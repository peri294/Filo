import { describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./test-db";

const DEV = "postgresql://u:c@ep-dev.sa-east-1.aws.neon.tech/neondb";
const PROD = "postgresql://u:c@ep-prod.sa-east-1.aws.neon.tech/neondb";
const TEST = "postgresql://u:c@ep-test.sa-east-1.aws.neon.tech/neondb";

describe("base de los tests", () => {
  it("[001-CA-3] los tests no corren sin base propia ni contra la de desarrollo o producción", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: DEV })).toThrow(/TEST_DATABASE_URL/);
    expect(() => testDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: DEV })).toThrow(/misma base/);
    expect(() => testDatabaseUrl({ DATABASE_URL_UNPOOLED: PROD, TEST_DATABASE_URL: PROD })).toThrow(/misma base/);
    expect(testDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: TEST })).toBe(TEST);
  });
});
