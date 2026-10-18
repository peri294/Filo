<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Turnos online para barberías (SaaS multi-barbería)

Plataforma de turnos para varias barberías (Argentina). Cada barbería tiene su página en `/<slug>`, su panel
y barberos con agenda propia. Los clientes tienen una sola cuenta para todas las barberías.

## Puesta en marcha (local o en la nube)

```bash
cp .env.example .env          # .env no se commitea; completar SUPERADMIN_PHONE y SUPERADMIN_PASSWORD
npm install                   # corre prisma generate en el postinstall
npx prisma migrate deploy     # (migrate reset pide confirmación escrita del usuario cuando lo corre una IA)
npx prisma db seed            # superadmin + barbería "demo" con 2 barberos (claves de demo en prisma/seed.ts)
npm run dev                   # http://localhost:3000 · /demo · /panel · /cuenta
```

Sin TWILIO_* configurado, fuera de producción los códigos SMS se escriben en la consola del servidor.

Chequeos antes de dar algo por terminado: `npm run check` (= `format:check` + `typecheck` + `lint` + `specs` + `test` + `build`).
Antes de commitear, `npm run format` deja el código con el formato de Prettier. Node 24 (`.nvmrc`; npm falla con otra versión).
Los tests (Vitest, en `tests/`) usan una base aparte `prisma/test.db` que se recrea con las migraciones en cada corrida; nunca tocan `prisma/dev.db`.

## Forma de trabajo: SDD + TDD con roles aislados

Detalle en [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md) y [`docs/roles/`](docs/roles/README.md). Resumen:

- **Comportamiento nuevo = spec primero.** `docs/specs/NNN-nombre/` con `spec.md`, `plan.md`, `tareas.md`,
  `bitacora.md` y `revision.md` (plantillas en `docs/specs/_plantilla/`). Sin spec `Aprobada` y sin preguntas
  abiertas no se escribe código.
- **Roles aislados:** especificador → planificador → por cada tarea, tester (tests en rojo) → implementador (código
  en verde) → revisor. Cada sesión toma **un solo rol** y toca solo sus archivos (`docs/roles/permisos.json`).
- **Trazabilidad:** cada criterio `CA-n` de la spec `NNN` tiene un test con `[NNN-CA-n]` en el nombre.
- Una spec que choque con [`docs/constitucion.md`](docs/constitucion.md) no se aprueba sin enmendarla antes (art. 9).

## Protocolo para cualquier agente (Claude, Gemini, Grok, Codex…)

Este archivo es la **guía única** del proyecto. `CLAUDE.md` y `GEMINI.md` solo apuntan acá: si algo cambia, se
cambia en este archivo.

**Al empezar cada sesión:**
1. Leer **`docs/constitucion.md` completa**. Manda sobre todo lo demás: constitución > spec > plan > código.
2. Leer `docs/flujo-de-trabajo.md` y `docs/roles/README.md`.
3. **Tomar un solo rol** y leer su documento. Si el dueño no dijo cuál, preguntar:

   | Pedido del dueño | Rol |
   | --- | --- |
   | Funcionalidad o cambio de comportamiento nuevo | `docs/roles/especificador.md` |
   | Planear una spec aprobada | `docs/roles/planificador.md` |
   | Escribir los tests de una tarea o de un bug | `docs/roles/tester.md` |
   | Hacer pasar los tests de una tarea o de un bug | `docs/roles/implementador.md` |
   | Revisar y cerrar una spec | `docs/roles/revisor.md` |
   | Configuración, dependencias, CI, docs generales | `docs/roles/mantenedor.md` |

4. Si el trabajo es de una spec, leer su carpeta `docs/specs/NNN-*/`, empezando por `bitacora.md`: ahí está lo que
   dejó la sesión anterior, que puede haber sido de otro rol y de otro agente.

**Mientras trabaja:**
- Hacer **solo el trabajo del rol**, aunque el de otro parezca rápido. Si hace falta algo de otro rol, se anota en la
  bitácora y se frena.
- **Cada commit lleva una línea `Rol: <rol>`** y toca solo los archivos de ese rol. El hook `commit-msg` y el CI lo
  rechazan si no.
- **Todo lo decidido queda escrito en el repo** (spec, plan, tareas, bitácora, revisión), nunca solo en el chat: la
  próxima sesión puede ser de otro agente y no ve esta conversación.
- Frenar y esperar al dueño en los puntos que marca cada rol y ante cualquier choque con la constitución. Solo el
  dueño la enmienda.
- No commitear, pushear ni mergear sin que el dueño lo pida. Todo cambio entra a `main` por PR.
- **Nunca saltear los controles:** nada de `git commit --no-verify` ni de desactivar los hooks o el CI. Si un
  control falla, se arregla la causa.

**Al terminar la sesión:** anotar una línea en `bitacora.md` de la spec (fecha, rol, agente, qué se hizo, qué sigue)
y dejar `npm run check` en verde, o explicar por qué no (por ejemplo, el tester deja tests en rojo a propósito).

## Stack

- Next.js 16 (App Router, `params`/`searchParams`/`cookies()` son async). Leer `node_modules/next/dist/docs/` ante dudas.
- Prisma 7: SQLite en desarrollo y tests; **PostgreSQL en producción** (constitución 5.2, migración todavía pendiente). Adapter `@prisma/adapter-better-sqlite3`. Cliente generado en `src/generated/prisma` (no se commitea).
- Tailwind v4: tokens de color y utilidades (`card`, `btn-primary`, `input`, etc.) en `src/app/globals.css`.

## Roles y rutas

- **Cliente** (`Client`): cuenta global con celular verificado por SMS. `/cuenta` (mis turnos), `/cuenta/ingresar`,
  `/cuenta/registro`, `/cuenta/recuperar`. Reservar exige sesión.
- **Barbería** (`Tenant`): páginas públicas en `src/app/[slug]/` (inicio, `reservar`, `turno/[token]`).
- **Personal** (`StaffUser`, rol `SUPERADMIN` | `ADMIN` | `BARBER`): `/panel` (agenda, `configuracion` solo admin,
  `metricas`, `recuperar`) y `/superadmin`. El admin puede ser también barbero (`barberId`).
- Páginas de la plataforma en `src/app/(sistema)/`; API en `src/app/api/{[slug],cuenta,panel,superadmin}`.

## Dónde está cada cosa

- `src/lib/tenant.ts`: **único lugar** que resuelve la barbería (`findTenantBySlug`, `requireActiveTenant`, slugs reservados).
  Para subdominios o dominios propios, traducir host → slug acá (vía `proxy.ts`).
- `src/lib/booking.ts`: reservas, disponibilidad por barbero, vencimientos, cancelaciones, agenda y permisos (`canManage`).
- `src/lib/auth.ts`: sesiones (tabla `Session`, cookies separadas STAFF/CLIENT), login, registro, recuperación, `requireStaff`.
- `src/lib/otp.ts` + `src/lib/sms.ts`: códigos por SMS (Twilio) con límites contra el bombeo de SMS.
- `src/lib/admin-config.ts`: configuración del local, servicios y barberos. `src/lib/metrics.ts`: métricas.
- `src/lib/superadmin.ts`: alta y suspensión de barberías.
- `src/lib/schedule.ts`: horario por día (JSON `weeklyHours`); `src/lib/time.ts`: hora de Argentina; `src/lib/format.ts`: celulares y precios.
- `src/lib/http.ts`: `handle`, `handleSameSite`, `handleStaff(request, roles, fn)`, `handleClient`, `clientIp`.

## Constitución (reglas que no hay que romper)

Las reglas de negocio, seguridad, datos y proceso están en [`docs/constitucion.md`](docs/constitucion.md).
**Leerla entera antes de cualquier tarea.** Manda sobre cualquier spec o plan y solo el dueño la enmienda.
