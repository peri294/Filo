@AGENTS.md

# Barbería · Turnos online

Web de turnos para una barbería (Argentina). El alcance de la Fase 1 está en `PLAN_IMPLEMENTACION.md`.
Este proyecto vive en la carpeta `PagWeb/` del repo `proyectos`: correr todos los comandos desde acá.

## Puesta en marcha (local o en la nube)

```bash
cp .env.example .env          # .env no se commitea
npm install                   # corre prisma generate en el postinstall
npx prisma migrate deploy     # (migrate reset pide confirmación escrita del usuario cuando lo corre una IA)
npx prisma db seed
npm run dev                   # http://localhost:3000 · panel en /admin (clave: ADMIN_PASSWORD de .env)
```

Chequeos antes de dar algo por terminado: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Los tests (Vitest, en `tests/`) usan una base aparte `test.db` que se recrea con las migraciones en cada corrida; nunca tocan `dev.db`.

## Stack

- Next.js 16 (App Router, `params`/`searchParams`/`cookies()` son async). Leer `node_modules/next/dist/docs/` ante dudas.
- Prisma 7 con SQLite local y adapter `@prisma/adapter-better-sqlite3`. Cliente generado en `src/generated/prisma` (no se commitea).
- Tailwind v4: tokens de color y utilidades (`card`, `btn-primary`, `input`, etc.) en `src/app/globals.css`.

## Dónde está cada cosa

- `src/lib/booking.ts`: toda la lógica de negocio (disponibilidad, reservas, vencimientos, cancelaciones, panel).
- `src/lib/time.ts`: fechas en hora de Argentina (`America/Argentina/Buenos_Aires`). No usar la zona del servidor.
- `src/lib/format.ts`: precios, normalización de celulares (`549` + 10 dígitos) y links de WhatsApp.
- `src/lib/admin-auth.ts`: sesión del panel (cookie firmada con HMAC).
- `src/app/api/**`: route handlers finos que validan con zod y llaman a `booking.ts`.

## Reglas de negocio que no hay que romper

- Cada bloque de 5 minutos ocupado (`LOCK_UNIT_MIN`, fijo, no depende de la grilla) es una fila en `SlotLock`
  con `startsAt` único: así la base impide reservas dobles. `PhoneHold` hace lo mismo con "1 turno activo por celular".
  Al cancelar o vencer un turno se borran los dos (`releaseHolds`).
- Efectivo: el turno queda `PENDIENTE_WHATSAPP` 15 minutos. Si el cliente marca "Ya envié el mensaje"
  (`clientNotifiedAt`), el vencimiento se extiende hasta 12 h (sin pasar el inicio del turno) para que el barbero confirme.
  Los vencidos se liberan en `releaseExpired()`, sin cron.
- Anti-spam (decisión del dueño, no cambiar a "1 por IP"): 1 turno activo por celular y máximo 3 reservas por hora por IP.
  La IP sale de `clientIp()` en `src/lib/http.ts` (en Vercel, `x-real-ip`).
- El cliente cancela solo si faltan más de 24 h. El link del comprobante usa `accessToken` (largo, no adivinable);
  el código corto `TURN-XXXXXX` solo sirve para buscar el turno junto con el celular (con límite de intentos).
- Reembolsos (con Mercado Pago): solo totales, nunca parciales.
- Panel: sesiones en la tabla `AdminSession`; límites de intentos en `RateLimit` (no en memoria: Vercel tiene varias instancias).
  Las rutas con cookie usan `handleAdmin`/`handleSameSite`, que rechazan pedidos de otro origen.
- Mercado Pago todavía NO se integra (se hará más adelante con el MCP de Mercado Pago). No tocar esa parte.

## Convenciones

- Toda la UI y los mensajes de error en español rioplatense (vos).
- Precios en pesos enteros (`Int`), nunca `Float`.
- Mobile-first.
