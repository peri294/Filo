# Proceso: implementar una tarea con TDD

**Entrada:** una tarea (`NNN Tn`) o un bug (descripción del comportamiento incorrecto).
**Salida:** la tarea hecha, con su test, toda la suite en verde y la tarea marcada en `tareas.md`.

Si es una tarea de spec, leer `spec.md`, `plan.md` y `tareas.md` de `docs/specs/NNN-*/` (incluida la bitácora,
para saber qué dejó la sesión anterior) y tomar la tarea pedida. Si el plan no está revisado por el dueño, frenar.
Si es un bug, el criterio es el comportamiento correcto esperado.

Seguir los pasos **en orden, sin saltear ninguno**:

1. 🔴 **Rojo**
   - Escribir el o los tests en `tests/` siguiendo el estilo existente: nombres en español que describen el
     comportamiento, con el número de spec y el ID del criterio (`it("[001-CA-2] …")`), helpers de
     `tests/fixtures.ts` y la hora fija con `vi.useFakeTimers({ toFake: ["Date"] })` + `setNow`.
   - Correr solo esos tests: `npx vitest run tests/<archivo>.test.ts -t "001-CA-2"`.
   - Confirmar que **fallan por la razón esperada** (una aserción, no un import roto ni un error de tipos) y mostrar
     el fallo. Si pasan de entrada, el test no prueba nada nuevo: revisarlo antes de seguir.
2. 🟢 **Verde**
   - Escribir el mínimo código de producción para que pasen. Nada fuera de la tarea.
   - Correr de nuevo los tests de la tarea y después `npm test` completo.
3. 🔵 **Refactor**
   - Limpiar duplicación y nombres, respetando el estilo del código vecino. `npm test` tiene que seguir en verde.
   - Correr `npm run typecheck` y `npm run lint`.
4. Marcar la tarea como hecha en `tareas.md`, anotar la sesión en la bitácora y resumir al dueño qué tests se
   agregaron, cómo fallaron en rojo y qué código cambió. Proponer el mensaje de commit (`feat(<área>): …` o
   `fix(<área>): …`) pero **no commitear sin que el dueño lo pida**.

**Nunca relajar ni borrar un test existente para que pase el nuevo** (art. 7.4). Si un test viejo choca con la spec,
frenar y preguntar al dueño cuál de los dos manda.
