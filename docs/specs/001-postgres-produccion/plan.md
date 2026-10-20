# 001 · Plan técnico

Spec: [spec.md](spec.md)

## Enfoque

Se cambia el proveedor de Prisma a PostgreSQL en todos los entornos (constitución 5.2, versión 2.0.0) y el adapter
`@prisma/adapter-better-sqlite3` por `@prisma/adapter-pg`. Cada entorno tiene su base:

| Entorno | Base | Variables |
| --- | --- | --- |
| Desarrollo | Neon, rama `dev` (conexión directa) | `DATABASE_URL` |
| Tests en local | Neon, rama `test` (directa) | `TEST_DATABASE_URL` |
| CI | Postgres del workflow (`services: postgres`) | `TEST_DATABASE_URL` |
| Producción (Vercel) | Neon, rama `production` | `DATABASE_URL` (con pooler) y `DATABASE_URL_UNPOOLED` (directa) |

En producción las migraciones y el alta del superadmin corren en el build de Vercel (6.3), solo cuando
`VERCEL_ENV=production`. Así las claves de producción solo existen en Vercel (5.5) y los previews de los PR compilan
sin tocar ninguna base.

Base: el mismo cambio ya está hecho y probado en `peri294/pagWeb` (`c9f9411`, `7c945ef`). Acá se rehace con TDD y
con los controles de este repo.

**Descartado:**

- _SQLite en desarrollo y Postgres en producción:_ Prisma usa un proveedor por esquema y las migraciones son por
  proveedor. Habría dos historias de migraciones y los tests no probarían la base real.
- _Migrar con la URL con pooler:_ `prisma migrate` necesita una sesión directa (el pooler de Neon trabaja por
  transacción).
- _Migrar a mano desde la máquina del dueño:_ obliga a tener la URL de producción en local.
- _CI contra la rama `test` de Neon:_ pide un secreto en un repo público y compartiría la base con los tests locales.

## Cambios por capa

| Capa | Archivo | Cambio |
| --- | --- | --- |
| Base | `prisma/schema.prisma` | `provider = "postgresql"`. |
| Base | `prisma/migrations/` | Sale `20261007000000_init` (SQLite) y entra `20261020000000_init` (Postgres), generada con `prisma migrate diff --from-empty`. `migration_lock.toml` pasa a `postgresql`. |
| Lógica | `src/lib/db.ts` | `new PrismaPg({ connectionString: process.env.DATABASE_URL })`. |
| Config | `prisma/entorno.ts` (nuevo) | Funciones puras: `urlDeMigraciones(env)` (CA-5) y `crearDemo(env)` (CA-4). |
| Config | `prisma.config.ts` | `datasource.url = urlDeMigraciones(process.env)`. |
| Seed | `prisma/seed.ts` | Adapter de Postgres; la barbería demo solo si `crearDemo(process.env)`. |
| Build | `scripts/vercel-build.mjs` (nuevo) + `vercel.json` | En `VERCEL_ENV=production`: `prisma migrate deploy` y `prisma db seed`; siempre `next build`. `vercel.json` fija `buildCommand`, así no hay que configurarlo a mano en Vercel. |
| Tests | `tests/test-db.ts` | `testDatabaseUrl(env)`: exige `TEST_DATABASE_URL` y que no sea `DATABASE_URL` ni `DATABASE_URL_UNPOOLED` (CA-3). |
| Tests | `tests/global-setup.ts` | `DROP SCHEMA public CASCADE` + `CREATE SCHEMA` con `pg` y `prisma migrate deploy` (con las dos variables apuntando a la de tests). |
| Tests | `tests/fixtures.ts` | `resetDb` con un solo `TRUNCATE … RESTART IDENTITY CASCADE` (una ida y vuelta en vez de 12). |
| Tests | `vitest.config.mts` | `testTimeout` y `hookTimeout` de 30 s por la latencia de Neon. |
| Tests | `tests/entorno.test.ts`, `tests/test-db.test.ts`, `tests/postgres.test.ts` (nuevos); `tests/booking.test.ts` | Tests de CA-1, CA-3, CA-4 y CA-5; el test de reservas simultáneas existente pasa a llevar `[001-CA-2]`. |
| CI | `.github/workflows/check.yml` | `services: postgres` (imagen `postgres:17`) y `TEST_DATABASE_URL` hacia ese contenedor. |
| Deps | `package.json` | Sale `@prisma/adapter-better-sqlite3` (y `better-sqlite3` de `allowScripts`); entra `@prisma/adapter-pg@7.10`. |
| Docs | `AGENTS.md`, `README.md`, `.env.example`, `docs/flujo-de-trabajo.md` | Postgres y Neon en lugar de SQLite, `dev.db` y `test.db`. |

## Datos y migración

- El esquema no cambia: mismos modelos, claves e índices. `SlotLock (barberId, startsAt)` y `ClientHold
  (tenantId, clientId)` siguen siendo claves de la base (3.2).
- **Punto para revisar (5.3):** la migración de SQLite se reemplaza en lugar de agregar una nueva. Con otro
  proveedor no hay forma de "migrar" de una a otra: Prisma pide arrancar la historia de nuevo. Esa migración nunca se
  aplicó en producción, solo en los `dev.db` locales, así que no hay ninguna base compartida que quede desfasada.
- No hay datos que pasar: la rama `production` de Neon está vacía y la `dev` se llena con el seed.

## Seguridad y aislamiento

- No cambia ninguna consulta, así que el aislamiento por `tenantId`/`barberId` (3.1) queda igual. Lo cubre la suite
  existente, que ahora corre contra Postgres.
- La barbería demo, con claves públicas, nunca se crea en Vercel (CA-4).
- Los tests no pueden apuntar a la base de desarrollo ni a la de producción (CA-3, 7.6).
- Conexiones con `sslmode=verify-full` en Neon.

## Riesgos

- **Tests lentos con Neon (unos 2 minutos):** se acepta. Un solo `TRUNCATE` por test y timeouts de 30 s.
- **El hook antes del commit no corre tests**, así que no necesita base: no cambia.
- **Previews de Vercel sin base:** compilan, pero las páginas que consultan la base fallan. Si hiciera falta, se
  apuntan a la rama `dev` desde las variables de Vercel, sin cambiar código.
- **Sin Twilio**, en producción los clientes no se pueden registrar (fuera de alcance, va en otra spec).
- **Node 24 en Vercel:** `engines` pide `>=24 <25`. Si Vercel no lo toma solo, se elige en la configuración del
  proyecto.
