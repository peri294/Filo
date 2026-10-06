import { prisma } from "@/lib/db";

/**
 * Suma un intento a `key` y devuelve false si ya se alcanzó el límite en la ventana actual.
 * Vive en la base (no en memoria) para que funcione con varias instancias serverless.
 */
export async function consume(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= now) {
    const resetAt = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return true;
  }
  if (row.count >= limit) return false;
  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export async function isLimited(key: string, limit: number) {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  return !!row && row.resetAt > new Date() && row.count >= limit;
}

export async function resetLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
