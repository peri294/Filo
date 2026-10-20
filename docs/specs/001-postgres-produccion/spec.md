# 001 · PostgreSQL en producción y despliegue en Vercel

- **Estado:** Implementada <!-- Borrador | Aprobada | Implementada | Descartada -->
- **Fecha:** 2026-10-20
- **Roles afectados:** Superadmin (y, de forma indirecta, todos: es la base de la plataforma publicada)

## Problema

La plataforma todavía no está publicada. Usa SQLite, que en Vercel no sirve: el disco no persiste y la base se
perdería en cada despliegue (constitución 5.2). Ya existe el proyecto "Filo" en Neon (Postgres, São Paulo) con las
ramas `production`, `dev` y `test`, pero el código no lo usa. Un primer intento de publicar en Vercel falló porque el
repo no tiene cómo migrar la base ni crear el superadmin durante el despliegue.

## Objetivo

Que la plataforma quede publicada en Vercel con su base en Postgres (Neon), con las tablas creadas por las
migraciones y el superadmin dado de alta, sin que las claves de producción pasen por la máquina de nadie.

## Fuera de alcance

- SMS reales (Twilio): sin eso, en producción los clientes no se pueden registrar ni recuperar la clave. Va aparte.
- Dominio propio, subdominios por barbería y Mercado Pago.
- Pasar datos de `dev.db` a Postgres: no hay datos reales que conservar.
- Cambios de comportamiento de reservas, agenda o cuentas.

## Historias

- Como **superadmin**, quiero entrar a `/panel` en la plataforma publicada para dar de alta las primeras barberías.
- Como **dueño**, quiero que publicar sea hacer merge a `main`, sin pasos manuales contra la base de producción.

## Criterios de aceptación

- **CA-1** — Dado el esquema de la base / Cuando se aplican las migraciones sobre un Postgres vacío / Entonces se
  crean todas las tablas y la suite completa de reservas, cuentas y métricas pasa contra Postgres.
- **CA-2** — Dado un barbero con un horario libre / Cuando llegan dos reservas simultáneas para ese horario en
  Postgres / Entonces una sola se registra y la otra recibe un error 409 de horario ocupado (3.2 sigue garantizado
  por la base).
- **CA-3** — Dada la configuración de los tests / Cuando la base de tests falta o es la misma que la de desarrollo o
  la de producción / Entonces los tests se niegan a correr y no borran nada (7.6).
- **CA-4** — Dado un despliegue en Vercel / Cuando corre el seed / Entonces crea el superadmin con
  `SUPERADMIN_PHONE` y `SUPERADMIN_PASSWORD`, y **no** crea la barbería "demo" (sus claves son públicas).
- **CA-5** — Dadas una URL con pooler para la app y una directa / Cuando corren las migraciones / Entonces usan la
  directa (`DATABASE_URL_UNPOOLED`) y, si no existe, `DATABASE_URL`.

## Reglas que toca

- **5.2 — la contradice.** Dice "SQLite queda solo para desarrollo local y tests". Prisma admite **un solo proveedor
  por esquema** y las migraciones se escriben para ese proveedor: no se puede tener SQLite en desarrollo y Postgres
  en producción con el mismo juego de migraciones sin mantener dos. Además, probar sobre SQLite no prueba la base que
  corre en producción. Hace falta enmendarla (ver "Enmienda propuesta").
- **7.6 — la contradice en la forma.** Nombra `dev.db`; con Postgres, la base de desarrollo es otra. El principio
  (los tests nunca usan la base de desarrollo) se mantiene y CA-3 lo refuerza.
- **3.2** — las garantías de la base (`SlotLock`, `ClientHold`) tienen que seguir valiendo en Postgres: CA-2.
- **4.3** — se despliega en Vercel, el único lugar donde la IP es confiable.
- **5.5** — las URLs de Neon y las claves del superadmin viven solo en `.env` (local) y en Vercel, nunca en el repo.
- **6.3** — sin procesos permanentes: migrar y crear el superadmin se hace en el build de Vercel.
- **6.4** — dependencias: sale `@prisma/adapter-better-sqlite3` y entra `@prisma/adapter-pg` (con `pg`), de Prisma,
  en la misma versión 7.10.

### Enmienda (aprobada por el dueño el 2026-10-20, art. 9; va en el mismo cambio, 9.2)

- **5.2** pasa a decir: "**La base es PostgreSQL** en producción, en desarrollo y en tests (Neon: una rama para cada
  uno). *Por qué:* en serverless el disco no persiste, Prisma usa un solo proveedor por esquema y los tests tienen
  que probar la misma base que corre en producción."
- **7.6** pasa a decir: "Los tests nunca usan la base de desarrollo ni la de producción, ni la hora real."
- Versión **2.0.0** (9.3: se quita la regla de SQLite en desarrollo y tests).

## Textos de UI

Ninguno nuevo.

## Preguntas abiertas

- [x] ¿Aprobás la enmienda de 5.2 y 7.6 (Postgres en todos lados, versión 2.0.0)? **Sí** (dueño, 2026-10-20).
- [x] ¿Contra qué Postgres corre el CI de GitHub Actions? **Un Postgres en un contenedor del propio workflow**
  (`services: postgres`), sin secretos: el repo es público y así no hay ninguna URL de Neon en juego.
- [x] Para desarrollo local, ¿rama `dev` de Neon o Postgres local con Docker? **Ramas `dev` y `test` de Neon**, que
  ya están creadas y probadas. Se acepta que los tests tarden unos 2 minutos por la latencia.
