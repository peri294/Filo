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

Atajo en Claude Code: `/spec <descripción>`.

## 2. Planificar (`plan.md` + `tareas.md`)

- El plan dice dónde va cada cosa siguiendo "Dónde está cada cosa" de `CLAUDE.md`: la lógica en `src/lib/*`, las
  rutas de `src/app/api` solo validan con Zod y delegan.
- Si hay cambios de base: migración de Prisma nueva (nunca editar una migración ya aplicada).
- `tareas.md` parte el plan en pasos chicos, cada uno con los `CA-*` que cubre y el test que lo prueba. Una tarea
  debería caber en un commit.

Atajo: `/planear 001`.

## 3. Implementar cada tarea con TDD

1. 🔴 **Rojo:** escribir el test en `tests/` (nombre que describe el comportamiento, en español, con el ID del
   criterio: `it("[CA-2] el cliente no puede cancelar con menos de 24 h", …)`). Correrlo y **verlo fallar** por el
   motivo esperado (no por un import roto o un typo).
2. 🟢 **Verde:** el mínimo código que lo hace pasar. Nada de funcionalidad "ya que estoy".
3. 🔵 **Refactor:** limpiar con los tests en verde. Correr toda la suite.
4. Marcar la tarea en `tareas.md` y hacer commit.

Para iterar rápido: `npx vitest run tests/archivo.test.ts -t "CA-2"` o `npm run test:watch`.

Atajo: `/tdd 001 T3`.

### Qué se testea y cómo

- **Lógica de negocio (`src/lib/*`):** siempre, contra la base de prueba real (`test.db`), con los helpers de
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

- `npm run check` (typecheck + lint + tests + build) en verde.
- Cada `CA-*` de la spec tiene su test (`npm run test -- -t "CA-"` ayuda a verlos).
- La spec refleja lo que realmente se construyó; estado → `Implementada`.
- Si se enmendó la constitución, se sube su versión y se anota en su registro de cambios. Si cambió la ubicación de
  algo, se actualiza `CLAUDE.md` y/o el `README.md`.

Atajo: `/cerrar 001`.

## Cuándo no hace falta una spec

Cambios sin comportamiento nuevo: textos, estilos, renombres, actualizaciones de dependencias, refactors con los tests
en verde. Igual se corre `npm run check`. Un bug chico puede ir sin spec, pero **nunca sin test que lo reproduzca**.

## Convención de commits y ramas

- Una rama por spec: `feat/001-recordatorio-turno`. Commits tipo Conventional Commits en español:
  `test(booking): CA-2 cancelación con menos de 24 h`, `feat(booking): …`, `fix: …`, `docs(spec): …`.
- Lo ideal: el commit de la tarea incluye el test y el código juntos (el rojo se vio en local).
