import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

describe("base de datos", () => {
  it("[001-CA-1] las migraciones crean todas las tablas en Postgres", async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const tablas = rows.map((r) => r.table_name).filter((t) => t !== "_prisma_migrations");
    expect(tablas.sort()).toEqual(
      [
        "Appointment",
        "Barber",
        "BlockedSlot",
        "Client",
        "ClientHold",
        "OtpCode",
        "RateLimit",
        "Service",
        "Session",
        "SlotLock",
        "StaffUser",
        "Tenant",
      ].sort(),
    );
  });
});
