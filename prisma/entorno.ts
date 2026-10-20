// Decisiones que dependen del entorno (local, CI o Vercel). Funciones puras para poder testearlas.
type Env = Record<string, string | undefined>;

/**
 * URL con la que corren las migraciones: necesitan una conexión directa. En Vercel `DATABASE_URL` va con pooler
 * (para la app) y `DATABASE_URL_UNPOOLED` es la directa; en local alcanza con `DATABASE_URL`.
 */
export function urlDeMigraciones(env: Env) {
  return env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
}

/** Si el seed crea la barbería "demo". Nunca en producción ni en Vercel: sus claves son públicas. */
export function crearDemo(env: Env) {
  return env.NODE_ENV !== "production" && !env.VERCEL;
}
