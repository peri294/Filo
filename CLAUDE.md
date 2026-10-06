@AGENTS.md

# Turnos online para barberías (SaaS multi-barbería)

Plataforma de turnos para varias barberías (Argentina). Cada barbería tiene su página en `/<slug>`, su panel
y barberos con agenda propia. Los clientes tienen una sola cuenta para todas las barberías.
Este proyecto vive en la carpeta `PagWeb/` del repo `proyectos`: correr todos los comandos desde acá.

## Puesta en marcha (local o en la nube)

```bash
cp .env.example .env          # .env no se commitea; completar SUPERADMIN_PHONE y SUPERADMIN_PASSWORD
npm install                   # corre prisma generate en el postinstall
npx prisma migrate deploy     # (migrate reset pide confirmación escrita del usuario cuando lo corre una IA)
npx prisma db seed            # superadmin + barbería "demo" con 2 barberos (claves de demo en prisma/seed.ts)
npm run dev                   # http://localhost:3000 · /demo · /panel · /cuenta
```

Sin TWILIO_* configurado, fuera de producción los códigos SMS se escriben en la consola del servidor.

Chequeos antes de dar algo por terminado: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Los tests (Vitest, en `tests/`) usan una base aparte `test.db` que se recrea con las migraciones en cada corrida; nunca tocan `dev.db`.

## Stack

- Next.js 16 (App Router, `params`/`searchParams`/`cookies()` son async). Leer `node_modules/next/dist/docs/` ante dudas.
- Prisma 7 con SQLite local y adapter `@prisma/adapter-better-sqlite3`. Cliente generado en `src/generated/prisma` (no se commitea).
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

## Reglas de negocio que no hay que romper

- **Aislamiento:** toda consulta del panel filtra por `tenantId` del usuario; el barbero, además, por su `barberId`.
  Un recurso de otra barbería o de otro barbero responde **404** (no revela que existe).
- Cada bloque de 5 minutos ocupado de cada barbero (`LOCK_UNIT_MIN`) es una fila en `SlotLock` con clave
  `(barberId, startsAt)`: la base impide reservas dobles. `ClientHold (tenantId, clientId)` garantiza 1 turno activo
  por cliente en cada barbería. Al cancelar o vencer se borran los dos (`releaseHolds`).
- "El primero disponible" (`ANY_BARBER`) asigna al barbero libre con menos turnos ese día; si choca, prueba el siguiente.
- Horario efectivo de un barbero = su horario propio recortado al del local (`barberHours`).
- Efectivo: `PENDIENTE_WHATSAPP` 15 minutos; "Ya envié el mensaje" extiende hasta 12 h (sin pasar el inicio).
  La confirmación va al WhatsApp del local. Los vencidos se liberan en `releaseExpired()`, sin cron.
- Límite de 3 reservas por hora por IP (decisión del dueño, no cambiar a "1 por IP").
- El cliente cancela solo si faltan más de 24 h. Asistencia ("Vino"/"No vino") solo en turnos confirmados ya empezados.
- Recuperar clave: cada uno por SMS; plan B: el admin a sus barberos, el superadmin a los admins. Cambiar la clave cierra sesiones.
- Reembolsos (con Mercado Pago): solo totales. Mercado Pago todavía NO se integra; no tocar esa parte.

## Convenciones

- Toda la UI y los mensajes de error en español rioplatense (vos).
- Precios en pesos enteros (`Int`), nunca `Float`.
- Mobile-first.
- Los textos de `/terminos` y `/privacidad` son borradores: los tiene que revisar un abogado.
