import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Cookies en memoria en lugar de las de Next (no hay un pedido HTTP real en los tests).
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import {
  getCurrentClient,
  getCurrentStaff,
  loginClient,
  loginStaff,
  registerClient,
  requireStaff,
  resetPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { requestCode, verifyCode } from "@/lib/otp";
import { hashPassword } from "@/lib/passwords";
import { devOutbox } from "@/lib/sms";
import { setTenantActive } from "@/lib/superadmin";
import { advance, expectBookingError, makeShop, resetDb } from "./fixtures";

const PHONE = "5491160000000";

function lastCode(phone = PHONE) {
  const sms = devOutbox.filter((m) => m.phone === phone).at(-1);
  return sms?.text.match(/\b(\d{6})\b/)?.[1];
}

async function signUp(phone = PHONE, password = "clave-segura") {
  await requestCode(phone, "SIGNUP", "1.1.1.1");
  return registerClient({ phone, code: lastCode(normalizePhone(phone)!)!, name: "Laura", password, acceptTerms: true });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T11:00:00Z"));
  await resetDb();
  jar.clear();
  devOutbox.length = 0;
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("registro de clientes con código por SMS", () => {
  it("crea la cuenta con el código y deja la sesión iniciada", async () => {
    const client = await signUp("11 6000-0000");
    expect(client.phone).toBe(PHONE);
    expect((await getCurrentClient())?.id).toBe(client.id);
  });

  it("sin aceptar los términos, con código incorrecto o ya usado, falla", async () => {
    await requestCode(PHONE, "SIGNUP", "1.1.1.1");
    const code = lastCode()!;
    const base = { phone: PHONE, name: "Laura", password: "clave-segura", acceptTerms: true };
    await expectBookingError(registerClient({ ...base, code, acceptTerms: false }), 400);
    await expectBookingError(registerClient({ ...base, code: code === "000000" ? "111111" : "000000" }), 400);
    await registerClient({ ...base, code });
    jar.clear();
    await expectBookingError(registerClient({ ...base, code }), 400);
  });

  it("el código vence a los 10 minutos", async () => {
    await requestCode(PHONE, "SIGNUP", "1.1.1.1");
    advance(11);
    await expectBookingError(verifyCode(PHONE, "SIGNUP", lastCode()!), 400);
  });

  it("después de 5 intentos fallidos el código deja de servir", async () => {
    await requestCode(PHONE, "SIGNUP", "1.1.1.1");
    const code = lastCode()!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expectBookingError(verifyCode(PHONE, "SIGNUP", wrong), 400);
    await expectBookingError(verifyCode(PHONE, "SIGNUP", code), 400);
  });

  it("si el celular ya tiene cuenta, no se manda código: se avisa por SMS al dueño", async () => {
    await signUp();
    advance(2);
    await requestCode(PHONE, "SIGNUP", "1.1.1.1"); // misma respuesta que siempre
    expect(devOutbox.at(-1)!.text).toMatch(/Ya tenés una cuenta/);
  });
});

describe("límites de envío de SMS", () => {
  it("un código por minuto y 5 por día por celular", async () => {
    await requestCode(PHONE, "SIGNUP", "1.1.1.1");
    await expectBookingError(requestCode(PHONE, "SIGNUP", "1.1.1.1"), 429);
    for (let i = 0; i < 4; i++) {
      advance(2);
      await requestCode(PHONE, "SIGNUP", "1.1.1.1");
    }
    advance(2);
    await expectBookingError(requestCode(PHONE, "SIGNUP", "1.1.1.1"), 429);
  });

  it("10 por hora por IP aunque cambie el celular", async () => {
    for (let i = 0; i < 10; i++) await requestCode(`54911600000${String(i).padStart(2, "0")}`, "SIGNUP", "2.2.2.2");
    await expectBookingError(requestCode("5491160000099", "SIGNUP", "2.2.2.2"), 429);
  });
});

describe("recuperación de contraseña", () => {
  it("con un celular sin cuenta responde igual y no manda nada", async () => {
    await requestCode(PHONE, "RESET_CLIENT", "1.1.1.1");
    expect(devOutbox).toHaveLength(0);
  });

  it("cambia la clave y cierra las demás sesiones", async () => {
    await signUp();
    const viejaSesion = new Map(jar);
    advance(2);
    await requestCode(PHONE, "RESET_CLIENT", "1.1.1.1");
    await resetPassword("CLIENT", PHONE, lastCode()!, "clave-nueva-1");
    // La sesión vieja ya no sirve.
    jar.clear();
    for (const [k, v] of viejaSesion) jar.set(k, v);
    expect(await getCurrentClient()).toBeNull();
    jar.clear();
    expect(await loginClient(PHONE, "clave-segura", "1.1.1.1")).toMatch(/incorrectos/);
    expect(await loginClient(PHONE, "clave-nueva-1", "1.1.1.1")).toBeNull();
  });

  it("el personal recupera su clave por su lado, aunque el mismo celular sea cliente", async () => {
    const shop = await makeShop();
    await prisma.staffUser.create({
      data: {
        phone: PHONE,
        passwordHash: await hashPassword("clave-barbero"),
        name: "Ana",
        role: "BARBER",
        tenantId: shop.tenant.id,
        barberId: shop.ana.id,
      },
    });
    await signUp(); // el mismo celular, como cliente
    advance(2);
    await requestCode(PHONE, "RESET_STAFF", "1.1.1.1");
    await resetPassword("STAFF", PHONE, lastCode()!, "clave-barbero-2");
    expect((await getCurrentStaff())?.role).toBe("BARBER");
    expect(await loginClient(PHONE, "clave-segura", "1.1.1.1")).toBeNull(); // la de cliente no cambió
  });
});

describe("login del personal", () => {
  it("frena después de 5 intentos fallidos con el mismo celular", async () => {
    await prisma.staffUser.create({
      data: { phone: PHONE, passwordHash: await hashPassword("clave-buena"), name: "X", role: "SUPERADMIN" },
    });
    for (let i = 0; i < 5; i++) expect(await loginStaff(PHONE, "mala", `3.3.3.${i}`)).toMatch(/incorrectos/);
    expect(await loginStaff(PHONE, "clave-buena", "4.4.4.4")).toMatch(/Demasiados intentos/);
  });

  it("un ataque desde una IP no bloquea el ingreso del resto del personal", async () => {
    await prisma.staffUser.create({
      data: { phone: PHONE, passwordHash: await hashPassword("clave-buena"), name: "X", role: "SUPERADMIN" },
    });
    // 250 intentos fallidos desde una sola IP, con celulares distintos.
    for (let i = 0; i < 250; i++) await loginStaff(`11 7000-${String(i).padStart(4, "0")}`, "mala", "66.66.66.66");
    expect(await loginStaff("11 7000-9999", "mala", "66.66.66.66")).toMatch(/Demasiados intentos/);
    // El resto entra normalmente desde otra IP.
    expect(await loginStaff(PHONE, "clave-buena", "10.0.0.7")).toBeNull();
  });

  it("los ingresos correctos no consumen ningún límite", async () => {
    await prisma.staffUser.create({
      data: { phone: PHONE, passwordHash: await hashPassword("clave-buena"), name: "X", role: "SUPERADMIN" },
    });
    for (let i = 0; i < 30; i++) expect(await loginStaff(PHONE, "clave-buena", "10.0.0.8")).toBeNull();
  });

  it("con la barbería suspendida, el panel queda bloqueado", async () => {
    const shop = await makeShop();
    await prisma.staffUser.create({
      data: {
        phone: PHONE,
        passwordHash: await hashPassword("clave-buena"),
        name: "Admin",
        role: "ADMIN",
        tenantId: shop.tenant.id,
      },
    });
    expect(await loginStaff(PHONE, "clave-buena", "1.1.1.1")).toBeNull();
    expect((await requireStaff(["ADMIN"])).role).toBe("ADMIN");
    await setTenantActive(shop.tenant.id, false);
    await expectBookingError(requireStaff(["ADMIN"]), 401); // suspender cierra sus sesiones
    expect(await loginStaff(PHONE, "clave-buena", "1.1.1.1")).toBeNull();
    await expectBookingError(requireStaff(["ADMIN"]), 403);
  });

  it("un barbero no pasa un chequeo de admin", async () => {
    const shop = await makeShop();
    await prisma.staffUser.create({
      data: {
        phone: PHONE,
        passwordHash: await hashPassword("clave-buena"),
        name: "Ana",
        role: "BARBER",
        tenantId: shop.tenant.id,
        barberId: shop.ana.id,
      },
    });
    await loginStaff(PHONE, "clave-buena", "1.1.1.1");
    await expectBookingError(requireStaff(["ADMIN"]), 403);
  });
});
