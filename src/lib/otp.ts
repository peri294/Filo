import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { consume } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

/** Códigos de 6 dígitos por SMS para verificar el celular al registrarse y para recuperar la clave. */
export type OtpPurpose = "SIGNUP" | "RESET_CLIENT" | "RESET_STAFF";

const CODE_TTL_MS = 10 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Tope de SMS por día en todo el sistema (freno al fraude de "bombeo" de SMS). */
const DAILY_GLOBAL_CAP = Number(process.env.OTP_DAILY_CAP ?? 500);

function hashCode(phone: string, purpose: OtpPurpose, code: string) {
  return createHash("sha256").update(`${phone}:${purpose}:${code}`).digest("hex");
}

async function accountExists(phone: string, purpose: OtpPurpose) {
  if (purpose === "RESET_STAFF") return !!(await prisma.staffUser.findFirst({ where: { phone, active: true } }));
  return !!(await prisma.client.findUnique({ where: { phone } }));
}

const TOO_MANY = new BookingError(429, "Pediste demasiados códigos. Esperá un rato y probá de nuevo.");

/**
 * Pide un código. La respuesta es la misma exista o no la cuenta, para no revelar qué
 * celulares están registrados; solo se manda SMS cuando corresponde.
 */
export async function requestCode(rawPhone: string, purpose: OtpPurpose, ip: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new BookingError(400, "Ingresá un celular válido con código de área");

  if (!(await consume(`otp:ip:${ip}`, 10, 60 * MINUTE))) throw TOO_MANY;
  if (!(await consume(`otp:min:${phone}`, 1, MINUTE))) {
    throw new BookingError(429, "Ya te mandamos un código. Esperá un minuto para pedir otro.");
  }
  if (!(await consume(`otp:day:${phone}`, 5, DAY))) throw TOO_MANY;

  const exists = await accountExists(phone, purpose);
  // Registro con un celular que ya tiene cuenta: se avisa por SMS al dueño del número, no en la web.
  const sendCode = purpose === "SIGNUP" ? !exists : exists;
  if (!sendCode && purpose !== "SIGNUP") return;

  if (!(await consume("otp:global", DAILY_GLOBAL_CAP, DAY))) {
    throw new BookingError(503, "No podemos mandar códigos en este momento. Probá más tarde.");
  }

  if (!sendCode) {
    await sendSms(phone, "Ya tenés una cuenta con este celular. Si no recordás la clave, usá \"Olvidé mi contraseña\".");
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    // Un código nuevo invalida los anteriores del mismo tipo.
    prisma.otpCode.updateMany({ where: { phone, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.otpCode.create({
      data: { phone, purpose, codeHash: hashCode(phone, purpose, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  await sendSms(phone, `Tu código de verificación es ${code}. Vence en 10 minutos. No se lo pases a nadie.`);
}

/** Verifica y consume el código. Tira 400 si es incorrecto, vencido o ya usado. */
export async function verifyCode(phone: string, purpose: OtpPurpose, code: string) {
  const invalid = new BookingError(400, "El código es incorrecto o venció. Pedí uno nuevo.");
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= MAX_CODE_ATTEMPTS) throw invalid;

  const given = Buffer.from(hashCode(phone, purpose, code.trim()));
  const expected = Buffer.from(otp.codeHash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }
  // Marcarlo usado de forma atómica: si dos pedidos llegan juntos, solo uno lo consume.
  const { count } = await prisma.otpCode.updateMany({ where: { id: otp.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count === 0) throw invalid;
}
