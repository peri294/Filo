# 001 · Tareas

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Cada tarea se hace con TDD (🔴 test que falla → 🟢 mínimo código → 🔵 refactor) y termina en un commit.

- [x] **T1** — `prisma/entorno.ts` con `urlDeMigraciones` y `crearDemo`; usarlas en `prisma.config.ts` y
      `prisma/seed.ts` · Cubre: CA-4, CA-5 · Test: `tests/entorno.test.ts` › "[001-CA-4] en Vercel no se crea la
      barbería demo", "[001-CA-5] las migraciones usan la URL directa si existe"
- [x] **T2** — `testDatabaseUrl(env)` en `tests/test-db.ts` · Cubre: CA-3 · Test: `tests/test-db.test.ts` ›
      "[001-CA-3] los tests no corren sin base propia ni contra la de desarrollo o producción"
- [x] **T3** — Pasar a Postgres: proveedor, adapter, migración nueva, `db.ts`, seed, `global-setup`, `resetDb` y
      timeouts · Cubre: CA-1, CA-2 · Test: `tests/postgres.test.ts` › "[001-CA-1] las migraciones crean todas las
      tablas en Postgres"; `tests/booking.test.ts` › "[001-CA-2] dos reservas simultáneas del mismo barbero y
      horario: solo una gana" (el existente, con el ID)
- [ ] **T4** — CI con Postgres en un contenedor del workflow · Verificación: el job `check` en verde en el PR
- [ ] **T5** — `scripts/vercel-build.mjs` + `vercel.json` (migrar y crear el superadmin solo en producción) ·
      Cubre: CA-4 (de punta a punta) · Verificación: deploy de producción en Vercel y entrar a `/panel` como
      superadmin
- [x] **T6** — Docs: `AGENTS.md`, `README.md`, `.env.example`, `docs/flujo-de-trabajo.md` · Verificación:
      `npm run check`

## Cierre

- [ ] `npm run check` en verde
- [x] Todos los CA tienen test
- [ ] Spec en estado `Implementada` y actualizada a lo que se construyó
- [x] `AGENTS.md` / `README.md` al día si cambió alguna regla o ubicación

## Bitácora

Una línea por sesión, la escriba el agente que sea. Es lo primero que lee la sesión siguiente.

| Fecha | Agente | Qué se hizo | Qué sigue |
| --- | --- | --- | --- |
| 2026-10-20 | Claude Opus 5.5 | Spec en borrador. El primer deploy en Vercel falló (falta `vercel-build`; este repo sigue en SQLite). El cambio ya existe y está probado en `peri294/pagWeb` (`c9f9411`, `7c945ef`). | El dueño responde las preguntas abiertas y aprueba (o no) la enmienda de 5.2 y 7.6; después, plan. |
| 2026-10-20 | Claude Opus 5.5 | El dueño aprobó la spec y la enmienda (constitución 2.0.0, ya aplicada), con CI en contenedor y Neon en local. Plan y tareas escritos. | El dueño revisa el plan, en especial el reemplazo de la migración de SQLite (5.3). Después, T1. |
| 2026-10-20 | Claude Opus 5.5 | Plan aprobado (con el reemplazo de la migración). T1, T2, T3 y T6 hechas con TDD: 81 tests en verde contra la rama `test` de Neon. T4 (CI con `services: postgres`) y T5 (`vercel-build.mjs` + `vercel.json`) escritas. Build sin variables de base: OK. Se agregó el script `vercel-build` a `package.json` para que ande también con el override puesto a mano en Vercel. | Commit y PR (cuando lo pida el dueño); verificar T4 con el CI y T5 con el deploy de producción; después, cierre. La rama `dev` de Neon tiene la migración vieja de pagWeb: hay que resetearla (pide confirmación del dueño). |
