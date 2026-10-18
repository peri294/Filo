# Flujo de trabajo: SDD + TDD con roles aislados

Todo cambio que toque comportamiento sigue dos ciclos encadenados, repartidos entre roles que no se pisan:

- **SDD (Spec-Driven Development):** primero se escribe *qué* tiene que pasar y *por qué* (la spec), después *cómo*
  (el plan) y recién ahí se parte en tareas. La spec es la fuente de verdad: si el código y la spec no coinciden,
  se corrige uno de los dos a propósito, nunca se deja la diferencia.
- **TDD (Test-Driven Development):** cada tarea se implementa con el ciclo rojo → verde → refactor. Ninguna línea de
  lógica nueva entra sin un test que antes haya fallado por la razón correcta. **El rojo lo escribe el tester y el
  verde, el implementador**, así el que programa no puede acomodar los tests a su código.

El puente entre los dos son los **criterios de aceptación** (`CA-1`, `CA-2`, …): cada uno vive en la spec y tiene al
menos un test que lo nombra (`[NNN-CA-n]`).

```
 📝 especificador ─► 🗺️ planificador ─► por cada tarea: 🔴 tester ─► 🟢 implementador ─► 🔍 revisor
    spec.md            plan.md             tests/ en rojo     src/ en verde        revision.md
    (qué/por qué)      tareas.md                              + refactor           + cierre
      [dueño aprueba]    [dueño revisa]                                              [dueño mergea]
```

Qué hace cada rol, qué puede tocar y cuándo frena: [`roles/`](roles/README.md).

## La constitución

[`constitucion.md`](constitucion.md) reúne los principios que no se negocian (producto, dominio, seguridad, datos,
arquitectura y proceso) y manda sobre todo: **constitución > spec > plan > código**. Una spec que choque con un
artículo lo dice en "Reglas que toca" y no se aprueba hasta que el dueño enmiende la constitución (art. 9).

## 1. Especificar — rol [especificador](roles/especificador.md)

- La spec vive en `docs/specs/NNN-nombre/spec.md` y habla del **comportamiento visible** (qué ve o puede hacer cada
  usuario), no de archivos ni funciones.
- Cada criterio de aceptación se escribe como **Dado / Cuando / Entonces**, con un ID estable (`CA-1`…). Un criterio
  que no se puede probar con un test no es un criterio: se reescribe.
- Las dudas van a "Preguntas abiertas". **Con preguntas abiertas no se pasa al plan.**
- Estado de la spec: `Borrador` → `Aprobada` (por el dueño) → `Implementada` (por el revisor), o `Descartada`.

## 2. Planificar — rol [planificador](roles/planificador.md)

- El plan dice dónde va cada cosa siguiendo "Dónde está cada cosa" de `AGENTS.md`: la lógica en `src/lib/*`, las
  rutas de `src/app/api` solo validan con Zod y delegan.
- Si hay cambios de base: migración de Prisma nueva (nunca editar una migración ya aplicada).
- `tareas.md` parte el plan en pasos chicos. Cada tarea dice los `CA-n` que cubre, **qué test escribe el tester** y
  **qué funciones va a necesitar** (nombre y firma): es el contrato entre el tester y el implementador.

## 3. Cada tarea: tester, después implementador

1. 🔴 **Tester** ([rol](roles/tester.md)): escribe los tests de la tarea en `tests/`
   (`it("[001-CA-2] el cliente no puede cancelar con menos de 24 h", …)`), los corre y **los ve fallar** porque falta
   el comportamiento. Puede usar funciones que todavía no existen, con la firma que dice la tarea. Commit con
   `Rol: tester`.
2. 🟢 **Implementador** ([rol](roles/implementador.md)): escribe el mínimo código que los hace pasar, sin tocar los
   tests, y después 🔵 refactoriza con todo en verde. Marca la tarea. Commit con `Rol: implementador`.

Para iterar rápido: `npx vitest run tests/archivo.test.ts -t "001-CA-2"` o `npm run test:watch`.

### Qué se testea y cómo

- **Lógica de negocio (`src/lib/*`):** siempre, contra la base de prueba real (`prisma/test.db`), con los helpers de
  [`tests/fixtures.ts`](../tests/fixtures.ts) (`makeShop`, `makeClient`, `book`, `setNow`, `advance`…).
  Si un caso necesita un helper nuevo, lo agrega el tester ahí.
- **El tiempo se controla:** `vi.useFakeTimers({ toFake: ["Date"] })` + `setNow(AHORA)`. Nunca depender de la hora real.
- **Aislamiento entre barberías y entre barberos:** todo recurso nuevo del panel lleva un test que muestra que desde
  otra barbería (u otro barbero) responde como inexistente (`404`).
- **Errores:** se prueba el error de negocio concreto (`expectBookingError`), no solo que "tira algo".
- **Rutas HTTP y UI:** se mantienen delgadas para que la lógica quede cubierta en `src/lib`. Si una ruta tiene
  lógica propia que importa (permisos, límites), se extrae a `src/lib` y se testea ahí.

## 4. Revisar y cerrar — rol [revisor](roles/revisor.md)

- Con ojos frescos: ¿los tests prueban lo que dicen los criterios? ¿El código hace lo que dice la spec, ni más ni
  menos? ¿Respeta la constitución? ¿Se relajó algún test?
- `npm run check` (formato + typecheck + lint + specs + tests + build) en verde. `npm run specs` controla estados,
  índice, preguntas abiertas, tareas marcadas y que cada `CA-n` de una spec `Implementada` tenga su test.
- Deja todo en `revision.md`. Si hay hallazgos, vuelven al tester o al implementador; si no, la spec pasa a
  `Implementada` y el dueño decide el merge.

## Trabajo entre sesiones y agentes

El flujo no depende de ningún agente: una spec puede especificarla Claude, testearla Gemini, implementarla Grok y
revisarla Claude de nuevo, en otra sesión. Para que eso funcione:

- **La guía única es [`AGENTS.md`](../AGENTS.md).** Grok, Codex y la mayoría de los agentes la leen solos; Gemini
  CLI la carga por `.gemini/settings.json`; Claude Code, por `CLAUDE.md` (que solo la importa). Nada de reglas en
  archivos de un solo agente.
- **Los roles son Markdown común** en [`roles/`](roles/README.md). Los atajos (`/especificar`, `/planear`,
  `/testear`, `/implementar`, `/revisar`) son envoltorios de una línea: `.claude/skills/*` y `.claude/agents/*`
  (subagentes con contexto limpio) para Claude Code y `.gemini/commands/*.toml` para Gemini CLI. Con cualquier otro
  agente, se le pide en palabras: *"tomá el rol de `docs/roles/tester.md` para 001 T2"*.
- **Una sesión, un rol.** Conviene que el tester, el implementador y el revisor de una spec sean sesiones distintas,
  e idealmente agentes distintos.
- **El estado vive en el repo, no en el chat.** Cada decisión se escribe en la spec, el plan, las tareas o la
  revisión. Cada sesión empieza leyendo `bitacora.md` de la spec y termina agregándole una línea (fecha, rol, agente,
  qué se hizo, qué sigue).
- **Los chequeos son de máquina** y no dependen de que el agente los respete:
  - **Hook `pre-commit`** (`.githooks/`, se activa solo con `npm install`): formato, lint y specs.
  - **Hook `commit-msg`:** el commit declara su rol (`Rol: …`) y toca solo los archivos de ese rol
    ([`roles/permisos.json`](roles/permisos.json)); después, typecheck (salvo para el tester, que puede dejar tests
    usando funciones que todavía no existen).
  - **CI en GitHub Actions** (`.github/workflows/check.yml`): el rol y los archivos de **cada commit del PR**, y
    `npm run check` completo en una máquina limpia.
  - **`main` protegida en GitHub:** solo entra por PR y con el CI en verde.
  - **Permisos de Claude Code** (`.claude/settings.json`): pide confirmación para `git push` y para resetear la base,
    y no puede leer `.env`. Para Gemini, Grok y el resto, el freno real es la protección de `main`.

## Cuándo no hace falta una spec

- **Bug:** tester (test que lo reproduce, en rojo) → implementador (arreglo). Nunca sin test.
- **Refactor sin cambio de comportamiento:** implementador, con los tests en verde y sin tocarlos.
- **Textos y estilos de la UI:** implementador.
- **Configuración, dependencias, CI, documentación general:** [mantenedor](roles/mantenedor.md), con aprobación del
  dueño.

Siempre con `npm run check` en verde.

## Convención de commits, ramas y PRs

- Una rama por spec: `feat/001-recordatorio-turno`. Commits tipo Conventional Commits en español, con la línea del
  rol al final:

  ```
  test(booking): 001-CA-2 el cliente no cancela con menos de 24 h

  Rol: tester
  ```

- Un commit es de **un solo rol**. Si un cambio necesita archivos de dos roles, son dos commits.
- Todo entra a `main` por PR. El PR completa la plantilla de `.github/pull_request_template.md` (spec, criterios,
  roles y agentes, bitácora) y necesita el CI en verde.
