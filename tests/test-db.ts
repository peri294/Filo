// Los tests usan una base Postgres propia (en local, la rama `test` de Neon; en el CI, el Postgres del workflow).
// global-setup.ts la vacía entera en cada corrida, así que nunca puede ser la de desarrollo ni la de producción.

/** La base de los tests: tiene que ser propia, nunca la de desarrollo ni la de producción (constitución 7.6). */
export function testDatabaseUrl(env: Record<string, string | undefined>) {
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error("Falta TEST_DATABASE_URL en .env (la rama `test` de Neon).");
  if (url === env.DATABASE_URL || url === env.DATABASE_URL_UNPOOLED) {
    throw new Error("TEST_DATABASE_URL no puede ser la misma base que DATABASE_URL ni que DATABASE_URL_UNPOOLED.");
  }
  return url;
}
