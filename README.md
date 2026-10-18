# Turnos online para barberías

Plataforma SaaS **multi-barbería** para reservar turnos online, pensada para Argentina. Cada barbería tiene su
página pública (`/<slug>`), un panel de gestión y barberos con agenda propia. Los clientes usan **una sola cuenta**,
verificada por SMS, para reservar en cualquier barbería de la plataforma.

> Estado: MVP funcional, con tests. El pago con Mercado Pago está modelado en la base pero todavía no integrado.

> Cómo se trabaja: [constitución del proyecto](docs/constitucion.md) y [flujo SDD + TDD](docs/flujo-de-trabajo.md).

## Funcionalidades

**Clientes**
- Registro e inicio de sesión con celular verificado por SMS (código de un solo uso).
- Reserva guiada: servicio → barbero (o "el primero disponible") → día → horario → confirmación.
- Pago en efectivo: reserva provisoria de 15 minutos que se confirma por WhatsApp con el local.
- Comprobante con link privado, "Mis turnos" y cancelación propia con más de 24 h de anticipación.

**Barberías (admin y barberos)**
- Agenda diaria y semanal; el barbero ve solo la suya, el admin la de todo el local.
- Confirmar o rechazar turnos, marcar asistencia ("Vino" / "No vino") y bloquear horarios.
- Configuración del local: horario por día de la semana, servicios, precios, duración, anticipación mínima.
- Alta de barberos con horario propio (recortado automáticamente al horario del local).
- Métricas: turnos, ingresos, ausencias, cancelaciones, clientes nuevos y recurrentes, ranking por barbero.

**Superadmin (dueño de la plataforma)**
- Alta, suspensión y reactivación de barberías; recuperación de acceso de los admins.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | **Next.js 16** (App Router, Server Components, Route Handlers) |
| UI | **React 19**, **Tailwind CSS v4**, lucide-react |
| Lenguaje | **TypeScript** (modo estricto) |
| Base de datos | **Prisma 7** (ORM + migraciones): **SQLite** (`better-sqlite3`) en desarrollo y tests; **PostgreSQL** en producción (pendiente) |
| Validación | **Zod 4** en todas las entradas de la API |
| Fechas | date-fns + `@date-fns/tz` (zona horaria de Argentina) |
| SMS | Twilio (API REST) |
| Tests | **Vitest** con base de datos real de prueba |
| Calidad | ESLint 9, `tsc --noEmit` |
| Deploy | Vercel |

## Arquitectura y decisiones técnicas

- **Multi-tenant por slug.** Toda consulta del panel filtra por la barbería del usuario (y por barbero cuando
  corresponde). Un recurso de otra barbería responde **404**, sin revelar que existe. La resolución del tenant está
  centralizada en `src/lib/tenant.ts`.
- **Reservas dobles imposibles a nivel base de datos.** Cada bloque de 5 minutos ocupado de un barbero es una fila
  de `SlotLock` con clave primaria `(barberId, startsAt)`. Dos reservas simultáneas del mismo horario chocan en la
  base dentro de una transacción, sin depender de chequeos previos en la aplicación.
- **Un turno activo por cliente y barbería**, garantizado con la tabla `ClientHold` (clave `(tenantId, clientId)`).
- **"El primero disponible"** asigna al barbero libre con menos turnos ese día; si hay conflicto, reintenta con el siguiente.
- **Vencimientos sin cron:** las reservas provisorias vencidas se liberan de forma perezosa (`releaseExpired()`) al
  consultar disponibilidad o reservar, lo que simplifica el deploy serverless.
- **Lógica de negocio separada de la capa HTTP:** las rutas de `src/app/api` validan y delegan en `src/lib/*`
  (`booking`, `auth`, `otp`, `metrics`, `admin-config`, `superadmin`), que es lo que cubren los tests.

## Seguridad

- Contraseñas con **scrypt** + salt aleatorio y comparación en tiempo constante (`timingSafeEqual`).
- Sesiones propias en base de datos: cookie `httpOnly`, `secure`, `sameSite=lax` con id aleatorio de 256 bits; en la
  base se guarda solo su hash SHA-256. Cookies separadas para personal y clientes. Cambiar la clave cierra las sesiones.
- Códigos SMS hasheados, con vencimiento, intentos limitados y tope diario global contra el **bombeo de SMS**.
- **Rate limiting** persistido en la base (funciona con varias instancias serverless): login por IP y por celular
  (solo cuentan los intentos fallidos), envío de SMS y reservas por IP.
- Chequeo del header `Origin` en las mutaciones (protección CSRF), control de acceso por rol (`SUPERADMIN` / `ADMIN` / `BARBER`).
- Cabeceras: `X-Frame-Options: DENY`; páginas privadas con `Cache-Control: no-store`, `Referrer-Policy: no-referrer`
  y `noindex`.
- Precios en pesos enteros (`Int`), nunca punto flotante.

## Modelo de datos

12 modelos Prisma: `Tenant`, `Barber`, `StaffUser`, `Client`, `Session`, `OtpCode`, `Service`, `Appointment`,
`BlockedSlot`, `SlotLock`, `ClientHold`, `RateLimit`. Ver [`prisma/schema.prisma`](prisma/schema.prisma).

## Estructura

```
src/
  app/
    (sistema)/        páginas de la plataforma: inicio, /cuenta, /panel, /superadmin, términos
    [slug]/           página pública de cada barbería, /reservar y comprobante /turno/[token]
    api/              Route Handlers: [slug], cuenta, panel, superadmin
  components/         formularios y componentes de cliente (wizard de reserva, editor de barberos...)
  lib/                lógica de negocio, auth, OTP, SMS, rate limiting, horarios
prisma/               schema, migraciones, seed y las bases SQLite locales (dev.db, test.db; ignoradas)
tests/                tests de integración (Vitest) contra una base SQLite aparte
scripts/              herramientas del repo (verificar-specs.ts: trazabilidad de las specs)
docs/                 constitución, flujo de trabajo, procesos, specs e históricos
.claude/ .gemini/     atajos de cada agente; la guía común está en AGENTS.md
```

En la raíz quedan solo los archivos que las herramientas buscan ahí: `package.json`, configuraciones de Next,
TypeScript, ESLint, PostCSS, Prisma y Vitest, `.env.example`, `.mcp.json` y las guías de agentes (`AGENTS.md`,
`CLAUDE.md`, `GEMINI.md`).

## Cómo correrlo

Requiere Node.js 20+.

```bash
cp .env.example .env          # completar SUPERADMIN_PHONE y SUPERADMIN_PASSWORD
npm install                   # también genera el cliente de Prisma
npx prisma migrate deploy
npx prisma db seed            # superadmin + barbería "demo" con 2 barberos
npm run dev
```

Abrir <http://localhost:3000/demo> (página pública), `/panel` (barbería) y `/cuenta` (cliente).
Sin credenciales de Twilio, los códigos SMS se muestran en la consola del servidor. Las claves de demo están en
[`prisma/seed.ts`](prisma/seed.ts).

## Tests y calidad

```bash
npm run check       # todo junto: typecheck + lint + specs + tests + build
npm test            # tests de integración (Vitest) sobre prisma/test.db, que se recrea en cada corrida
npm run specs       # trazabilidad de docs/specs (cada criterio con su test)
```

Los mismos chequeos corren solos: typecheck, lint y specs antes de cada commit (hook en `.githooks/`, que se activa
con `npm install`) y `npm run check` completo en GitHub Actions en cada push y PR. `main` solo acepta PRs con el CI
en verde.

Los tests cubren reservas concurrentes y dobles, asignación de "el primero disponible", vencimientos, cancelaciones,
aislamiento entre barberías y barberos, login, límites de intentos y flujos de recuperación por SMS.

## Próximos pasos

- Integración de Mercado Pago (Checkout Pro y reembolsos totales).
- Migración a Postgres para producción.
- Revisión legal de los textos de términos y privacidad (hoy son borradores).
