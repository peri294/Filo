# Flujo de trabajo: SDD + TDD

Todo cambio que toque comportamiento sigue dos ciclos encadenados:

- **SDD (Spec-Driven Development):** primero se escribe *qué* tiene que pasar y *por qué* (la spec), después *cómo*
  (el plan) y recién ahí se parte en tareas. La spec es la fuente de verdad: si el código y la spec no coinciden,
  se corrige uno de los dos a propósito, nunca se deja la diferencia.
- **TDD (Test-Driven Development):** cada tarea se implementa con el ciclo rojo → verde → refactor. Ninguna línea de
  lógica nueva entra sin un test que antes haya fallado por la razón correcta.

El puente entre los dos son los **criterios de aceptación** (`CA-1`, `CA-2`, …): cada uno vive en la spec y tiene al
menos un test que lo nombra.

```
 spec.md ──► plan.md ──► tareas.md ──► por cada tarea: 🔴 test ─► 🟢 código ─► 🔵 refactor ──► cierre
 (qué/por qué)  (cómo)    (pasos)                                                         (chequeos + spec al día)
```

## La constitución

[`constitucion.md`](constitucion.md) reúne los principios que no se negocian (producto, dominio, seguridad, datos,
arquitectura y proceso) y manda sobre todo: **constitución > spec > plan > código**. Una spec que choque con un
artículo lo dice en "Reglas que toca" y no se aprueba hasta que el dueño enmiende la constitución (art. 9).

## 1. Especificar (`docs/specs/NNN-nombre/spec.md`)

- Se copia [`docs/specs/_plantilla/`](specs/_plantilla/) a una carpeta numerada: `docs/specs/001-recordatorio-turno/`.
- La spec habla del **comportamiento visible** (qué ve o puede hacer cada rol), no de archivos ni funciones.
- Cada criterio de aceptación se escribe como **Dado / Cuando / Entonces**, con un ID estable (`CA-1`…). Un criterio
  que no se puede probar con un test no es un criterio: se reescribe.
- Las dudas van a "Preguntas abiertas". **Con preguntas abiertas no se pasa al plan.**
- Estado de la spec: `Borrador` → `Aprobada` → `Implementada` (o `Descartada`).

Proceso: [`procesos/spec.md`](procesos/spec.md) · atajo `/spec <descripción>`.

## 2. Planificar (`plan.md` + `tareas.md`)

- El plan dice dónde va cada cosa siguiendo "Dónde está cada cosa" de `AGENTS.md`: la lógica en `src/lib/*`, las
  rutas de `src/app/api` solo validan con Zod y delegan.
- Si hay cambios de base: migración de Prisma nueva (nunca editar una migración ya aplicada).
- `tareas.md` parte el plan en pasos chicos, cada uno con los `CA-*` que cubre y el test que lo prueba. Una tarea
  debería caber en un commit.

Proceso: [`procesos/planear.md`](procesos/planear.md) · atajo `/planear 001`.

## 3. Implementar cada tarea con TDD

1. 🔴 **Rojo:** escribir el test en `tests/` (nombre que describe el comportamiento, en español, con el ID del
   criterio, con el número de spec: `it("[001-CA-2] el cliente no puede cancelar con menos de 24 h", …)`). Correrlo y **verlo fallar** por el
   motivo esperado (no por un import roto o un typo).
2. 🟢 **Verde:** el mínimo código que lo hace pasar. Nada de funcionalidad "ya que estoy".
3. 🔵 **Refactor:** limpiar con los tests en verde. Correr toda la suite.
4. Marcar la tarea en `tareas.md` y hacer commit.

Para iterar rápido: `npx vitest run tests/archivo.test.ts -t "001-CA-2"` o `npm run test:watch`.

Proceso: [`procesos/tdd.md`](procesos/tdd.md) · atajo `/tdd 001 T3`.

### Qué se testea y cómo

- **Lógica de negocio (`src/lib/*`):** siempre, contra la base Postgres de prueba (`TEST_DATABASE_URL`), con los helpers de
  [`tests/fixtures.ts`](../tests/fixtures.ts) (`makeShop`, `makeClient`, `book`, `setNow`, `advance`…).
  Si un caso necesita un helper nuevo, se agrega ahí.
- **El tiempo se controla:** `vi.useFakeTimers({ toFake: ["Date"] })` + `setNow(AHORA)`. Nunca depender de la hora real.
- **Aislamiento entre barberías y entre barberos:** todo recurso nuevo del panel lleva un test que muestra que desde
  otra barbería (u otro barbero) responde como inexistente (`404`).
- **Errores:** se prueba el error de negocio concreto (`expectBookingError`), no solo que "tira algo".
- **Rutas HTTP y UI:** se mantienen delgadas para que la lógica quede cubierta en `src/lib`. Si una ruta tiene
  lógica propia que importa (permisos, límites), se extrae a `src/lib` y se testea ahí.
- Un bug se arregla igual: primero un test que lo reproduce (rojo), después el arreglo.

## 4. Cerrar

- `npm run check` (formato + typecheck + lint + specs + tests + build) en verde. `npm run specs` controla estados, índice,
  preguntas abiertas, tareas marcadas y que cada `CA-n` de una spec `Implementada` tenga su test.
- La spec refleja lo que realmente se construyó; estado → `Implementada`.
- Si se enmendó la constitución, se sube su versión y se anota en su registro de cambios. Si cambió la ubicación de
  algo, se actualiza `AGENTS.md` y/o el `README.md`.

Proceso: [`procesos/cerrar.md`](procesos/cerrar.md) · atajo `/cerrar 001`.

## Trabajo entre sesiones y agentes

El flujo no depende de ningún agente: una spec puede empezarla Claude, planearla Gemini y terminarla Grok.
Para que eso funcione:

- **La guía única es [`AGENTS.md`](../AGENTS.md).** Grok, Codex y la mayoría de los agentes la leen solos; Gemini
  CLI la carga por `.gemini/settings.json`; Claude Code, por `CLAUDE.md` (que solo la importa). Nada de reglas en
  archivos de un solo agente.
- **Los procesos son Markdown común** en [`procesos/`](procesos/). Los atajos (`/spec`, `/planear`, `/tdd`,
  `/cerrar`) son envoltorios de una línea: `.claude/skills/*` para Claude Code y `.gemini/commands/*.toml` para
  Gemini CLI. Con cualquier otro agente, se le pide en palabras: *"seguí `docs/procesos/tdd.md` para 001 T2"*.
- **El estado vive en el repo, no en el chat.** Cada decisión se escribe en la spec, el plan o las tareas. Cada
  sesión empieza leyendo la **bitácora** de `tareas.md` y termina agregándole una línea (fecha, agente, qué se hizo,
  qué sigue).
- **Los chequeos son de máquina** y no dependen de que el agente los respete:
  - **Hook antes del commit** (`.githooks/pre-commit`, se activa solo con `npm install`): formato, typecheck, lint y
    specs.
  - **CI en GitHub Actions** (`.github/workflows/check.yml`): `npm run check` completo en una máquina limpia, en cada
    push y en cada PR.
  - **`main` protegida en GitHub:** solo entra por PR y con el CI en verde.
  - **Permisos de Claude Code** (`.claude/settings.json`): pide confirmación para `git push` y para resetear la base,
    y no puede leer `.env`. Para Gemini, Grok y el resto, el freno real es la protección de `main`.
- **Una sesión, una tarea.** Conviene que cada sesión cierre su tarea con la suite en verde y la bitácora al día;
  así la siguiente arranca de un punto limpio.

## Cuándo no hace falta una spec

Cambios sin comportamiento nuevo: textos, estilos, renombres, actualizaciones de dependencias, refactors con los tests
en verde. Igual se corre `npm run check`. Un bug chico puede ir sin spec, pero **nunca sin test que lo reproduzca**.

## Convención de commits, ramas y PRs

- Una rama por spec: `feat/001-recordatorio-turno`. Commits tipo Conventional Commits en español:
  `test(booking): CA-2 cancelación con menos de 24 h`, `feat(booking): …`, `fix: …`, `docs(spec): …`.
- Lo ideal: el commit de la tarea incluye el test y el código juntos (el rojo se vio en local).
- Todo entra a `main` por PR. El PR completa la plantilla de `.github/pull_request_template.md` (spec, criterios,
  bitácora, agente) y necesita el CI en verde.
