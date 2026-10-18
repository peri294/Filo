@AGENTS.md

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

Chequeos antes de dar algo por terminado: `npm run check` (= `typecheck` + `lint` + `test` + `build`).
Los tests (Vitest, en `tests/`) usan una base aparte `test.db` que se recrea con las migraciones en cada corrida; nunca tocan `dev.db`.

## Forma de trabajo: SDD + TDD

Detalle en [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md). Resumen:

- **Comportamiento nuevo = spec primero.** `docs/specs/NNN-nombre/{spec,plan,tareas}.md` (plantilla en
  `docs/specs/_plantilla/`). Sin spec `Aprobada` y sin preguntas abiertas no se escribe código.
- **Cada tarea con TDD:** test que falla por la razón correcta → mínimo código → refactor. Los bugs también:
  primero el test que los reproduce.
- **Trazabilidad:** cada criterio `CA-n` de la spec tiene un test con `[CA-n]` en el nombre.
- Comandos: `/spec <idea>` → `/planear NNN` → `/tdd NNN Tn` (una vez por tarea) → `/cerrar NNN`.
- No hace falta spec para textos, estilos, refactors o dependencias, pero sí `npm run check`.
- Una spec que choque con [`docs/constitucion.md`](docs/constitucion.md) no se aprueba sin enmendarla antes (art. 9).

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

Las reglas de negocio, seguridad, datos y proceso están en la constitución y mandan sobre cualquier spec o plan.
Solo el dueño del proyecto aprueba cambios a ese archivo.

@docs/constitucion.md
