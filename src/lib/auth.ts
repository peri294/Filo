import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { verifyCode } from "@/lib/otp";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/passwords";
import { consume, resetLimit } from "@/lib/rate-limit";

/**
 * Dos tipos de sesión con cookies separadas:
 * - STAFF: superadmin, admin de barbería y barberos (/panel, /superadmin).
 * - CLIENT: clientes (/cuenta y reservas).
 * La cookie lleva un id aleatorio; en la tabla Session se guarda su hash.
 */
export type SessionKind = "STAFF" | "CLIENT";
export type StaffRole = "SUPERADMIN" | "ADMIN" | "BARBER";

const PROD = process.env.NODE_ENV === "production";
// En producción el prefijo __Host- obliga a HTTPS, path=/ y sin dominio.
const COOKIE: Record<SessionKind, string> = {
  STAFF: PROD ? "__Host-panel_session" : "panel_session",
  CLIENT: PROD ? "__Host-cliente_session" : "cliente_session",
};
const SESSION_HOURS: Record<SessionKind, number> = { STAFF: 12, CLIENT: 24 * 30 };

const WINDOW_MS = 15 * 60_000;
const MAX_PER_IP = 10;
const MAX_PER_PHONE = 5;
const MAX_GLOBAL = 200;

function hashId(id: string) {
  return createHash("sha256").update(id).digest("hex");
}

async function startSession(kind: SessionKind, ownerId: string) {
  const id = randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  await prisma.session.create({
    data: {
      idHash: hashId(id),
      kind,
      staffUserId: kind === "STAFF" ? ownerId : null,
      clientId: kind === "CLIENT" ? ownerId : null,
      expiresAt: new Date(now + SESSION_HOURS[kind] * 3_600_000),
    },
  });
  (await cookies()).set(COOKIE[kind], id, {
    httpOnly: true,
    sameSite: "lax",
    secure: PROD,
    path: "/",
    maxAge: SESSION_HOURS[kind] * 3600,
  });
}

async function currentSession(kind: SessionKind) {
  const id = (await cookies()).get(COOKIE[kind])?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { idHash: hashId(id) } });
  if (!session || session.kind !== kind || session.expiresAt <= new Date()) return null;
  return session;
}

export async function getCurrentStaff() {
  const session = await currentSession("STAFF");
  if (!session?.staffUserId) return null;
  const user = await prisma.staffUser.findUnique({
    where: { id: session.staffUserId },
    include: { tenant: true, barber: true },
  });
  return user?.active ? user : null;
}

export type CurrentStaff = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export async function getCurrentClient() {
  const session = await currentSession("CLIENT");
  if (!session?.clientId) return null;
  return prisma.client.findUnique({ where: { id: session.clientId } });
}

export type CurrentClient = NonNullable<Awaited<ReturnType<typeof getCurrentClient>>>;

/** Personal logueado con alguno de los roles pedidos y con su barbería activa. */
export async function requireStaff(roles: StaffRole[] = ["SUPERADMIN", "ADMIN", "BARBER"]) {
  const user = await getCurrentStaff();
  if (!user) throw new BookingError(401, "Iniciá sesión para continuar");
  if (!roles.includes(user.role as StaffRole)) throw new BookingError(403, "No tenés permiso para hacer esto");
  if (user.role !== "SUPERADMIN" && !user.tenant?.active) {
    throw new BookingError(403, "Esta barbería está suspendida. Comunicate con soporte.");
  }
  return user;
}

export async function requireClient() {
  const client = await getCurrentClient();
  if (!client) throw new BookingError(401, "Iniciá sesión para continuar");
  return client;
}

let dummyHash: Promise<string> | null = null;

/** Limita intentos por IP, por celular y en total. Devuelve un mensaje si hay que frenar. */
async function loginAllowed(scope: string, phone: string, ip: string) {
  const ok = [
    await consume(`login:${scope}:ip:${ip}`, MAX_PER_IP, WINDOW_MS),
    await consume(`login:${scope}:phone:${phone}`, MAX_PER_PHONE, WINDOW_MS),
    await consume(`login:${scope}:global`, MAX_GLOBAL, WINDOW_MS),
  ];
  return ok.every(Boolean);
}

async function checkPassword(password: string, hash: string | undefined) {
  // Con un usuario inexistente igual se calcula un hash, para no revelar por el tiempo de respuesta.
  dummyHash ??= hashPassword("contraseña-de-relleno");
  return verifyPassword(password, hash ?? (await dummyHash));
}

const WRONG_LOGIN = "Celular o contraseña incorrectos";

/** Devuelve un mensaje de error, o null si el login fue correcto. */
export async function loginStaff(rawPhone: string, password: string, ip: string): Promise<string | null> {
  const phone = normalizePhone(rawPhone) ?? "invalido";
  if (!(await loginAllowed("staff", phone, ip))) return "Demasiados intentos. Esperá unos minutos.";
  const user = await prisma.staffUser.findUnique({ where: { phone } });
  const ok = await checkPassword(password, user?.passwordHash);
  if (!user || !ok || !user.active) return WRONG_LOGIN;
  await resetLimit(`login:staff:ip:${ip}`);
  await resetLimit(`login:staff:phone:${phone}`);
  await startSession("STAFF", user.id);
  return null;
}

export async function loginClient(rawPhone: string, password: string, ip: string): Promise<string | null> {
  const phone = normalizePhone(rawPhone) ?? "invalido";
  if (!(await loginAllowed("client", phone, ip))) return "Demasiados intentos. Esperá unos minutos.";
  const client = await prisma.client.findUnique({ where: { phone } });
  const ok = await checkPassword(password, client?.passwordHash);
  if (!client || !ok) return WRONG_LOGIN;
  await resetLimit(`login:client:ip:${ip}`);
  await resetLimit(`login:client:phone:${phone}`);
  await startSession("CLIENT", client.id);
  return null;
}

export type RegisterInput = { phone: string; code: string; name: string; password: string; acceptTerms: boolean };

/** Crea la cuenta del cliente (con el celular verificado por SMS) y deja la sesión iniciada. */
export async function registerClient(input: RegisterInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new BookingError(400, "Ingresá un celular válido con código de área");
  if (!input.acceptTerms) throw new BookingError(400, "Para crear la cuenta tenés que aceptar los términos y la política de privacidad");
  const problem = passwordProblem(input.password);
  if (problem) throw new BookingError(400, problem);

  await verifyCode(phone, "SIGNUP", input.code);
  if (await prisma.client.findUnique({ where: { phone } })) {
    throw new BookingError(409, "Ya hay una cuenta con ese celular. Ingresá o recuperá tu contraseña.");
  }
  const now = new Date();
  const client = await prisma.client.create({
    data: {
      phone,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      phoneVerifiedAt: now,
      acceptedTermsAt: now,
    },
  });
  await startSession("CLIENT", client.id);
  return client;
}

/** Cambia la clave con un código SMS, cierra todas las sesiones de esa cuenta y abre una nueva. */
export async function resetPassword(kind: SessionKind, rawPhone: string, code: string, password: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new BookingError(400, "Ingresá un celular válido con código de área");
  const problem = passwordProblem(password);
  if (problem) throw new BookingError(400, problem);

  await verifyCode(phone, kind === "STAFF" ? "RESET_STAFF" : "RESET_CLIENT", code);
  const passwordHash = await hashPassword(password);
  if (kind === "STAFF") {
    const user = await prisma.staffUser.findUnique({ where: { phone } });
    if (!user || !user.active) throw new BookingError(400, "El código es incorrecto o venció. Pedí uno nuevo.");
    await prisma.$transaction([
      prisma.staffUser.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { staffUserId: user.id } }),
    ]);
    await startSession("STAFF", user.id);
  } else {
    const client = await prisma.client.findUnique({ where: { phone } });
    if (!client) throw new BookingError(400, "El código es incorrecto o venció. Pedí uno nuevo.");
    await prisma.$transaction([
      prisma.client.update({ where: { id: client.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { clientId: client.id } }),
    ]);
    await startSession("CLIENT", client.id);
  }
}

/** Plan B: el admin (a sus barberos) o el superadmin (a los admins) asignan una clave nueva. */
export async function setStaffPassword(userId: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new BookingError(400, problem);
  await prisma.$transaction([
    prisma.staffUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { staffUserId: userId } }),
  ]);
}

/** Borra la sesión en la base: la cookie deja de servir aunque alguien la haya copiado. */
export async function logout(kind: SessionKind) {
  const store = await cookies();
  const id = store.get(COOKIE[kind])?.value;
  if (id) await prisma.session.deleteMany({ where: { idHash: hashId(id) } });
  store.delete(COOKIE[kind]);
}
