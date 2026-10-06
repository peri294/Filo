import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";
const SESSION_HOURS = 12;

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Falta ADMIN_SESSION_SECRET (mínimo 16 caracteres)");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

/** Devuelve un mensaje de error, o null si el login fue correcto. */
export async function login(password: string, ip: string): Promise<string | null> {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return "Demasiados intentos. Esperá unos minutos.";
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !safeEqual(password, expected)) {
    const fresh = !entry || entry.resetAt <= now;
    attempts.set(ip, { count: fresh ? 1 : entry.count + 1, resetAt: fresh ? now + ATTEMPT_WINDOW_MS : entry.resetAt });
    return "Clave incorrecta";
  }

  attempts.delete(ip);
  const exp = String(now + SESSION_HOURS * 3_600_000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return null;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}
