import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { consume, resetLimit } from "@/lib/rate-limit";

// En producción el prefijo __Host- obliga a HTTPS, path=/ y sin dominio (no la pueden pisar subdominios).
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";
const SESSION_HOURS = 12;

const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS_PER_IP = 5;
const MAX_ATTEMPTS_GLOBAL = 30;

const EXAMPLE_PASSWORD = "cambiar-esta-clave";
const MIN_PASSWORD_LENGTH = 10;

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(a: string, b: string) {
  return timingSafeEqual(hash(a), hash(b));
}

/** En producción no se acepta la clave de ejemplo ni una clave corta. */
function configuredPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  if (process.env.NODE_ENV === "production" && (password === EXAMPLE_PASSWORD || password.length < MIN_PASSWORD_LENGTH)) {
    return null;
  }
  return password;
}

export async function isAdmin() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return false;
  const session = await prisma.adminSession.findUnique({ where: { idHash: hash(id).toString("hex") } });
  return !!session && session.expiresAt > new Date();
}

/** Devuelve un mensaje de error, o null si el login fue correcto. */
export async function login(password: string, ip: string): Promise<string | null> {
  const expected = configuredPassword();
  if (!expected) {
    return `El panel no está configurado: definí ADMIN_PASSWORD (mínimo ${MIN_PASSWORD_LENGTH} caracteres, distinta a la de ejemplo).`;
  }

  // Límite por IP y uno global, por si se rota la IP.
  const ipOk = await consume(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS);
  const globalOk = await consume("login:global", MAX_ATTEMPTS_GLOBAL, LOGIN_WINDOW_MS);
  if (!ipOk || !globalOk) return "Demasiados intentos. Esperá unos minutos.";

  if (!safeEqual(password, expected)) return "Clave incorrecta";

  await resetLimit(`login:ip:${ip}`);
  const now = new Date();
  const id = randomBytes(32).toString("base64url");
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.adminSession.create({
    data: { idHash: hash(id).toString("hex"), expiresAt: new Date(now.getTime() + SESSION_HOURS * 3_600_000) },
  });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return null;
}

/** Borra la sesión en la base: la cookie deja de servir aunque alguien la haya copiado. */
export async function logout() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) await prisma.adminSession.deleteMany({ where: { idHash: hash(id).toString("hex") } });
  store.delete(COOKIE);
}
