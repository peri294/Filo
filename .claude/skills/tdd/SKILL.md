---
name: tdd
description: Implementa una tarea de docs/specs/NNN-*/tareas.md con el ciclo TDD rojo-verde-refactor. También sirve para arreglar un bug test-first.
argument-hint: <spec> <tarea>, ej. "001 T2" — o "bug <descripción>"
disable-model-invocation: true
---

Implementar con TDD: **$ARGUMENTS**

Si es una tarea de spec, leer `spec.md`, `plan.md` y `tareas.md` de `docs/specs/<spec>-*/` y tomar la tarea pedida.
Si es un bug, el "criterio" es el comportamiento correcto esperado.

Seguir los pasos **en orden, sin saltear ninguno**:

1. 🔴 **Rojo**
   - Escribir el/los test(s) en `tests/` siguiendo el estilo existente: nombres en español que describen el
     comportamiento, con el ID del criterio (`it("[CA-2] …")`), helpers de `tests/fixtures.ts`, tiempo fijo con
     `vi.useFakeTimers({ toFake: ["Date"] })` + `setNow`.
   - Correr solo esos tests: `npx vitest run tests/<archivo>.test.ts -t "CA-2"`.
   - Confirmar que **fallan por la razón esperada** (aserción, no import roto ni error de tipos). Mostrar el fallo.
     Si pasan de entrada, el test no prueba nada nuevo: revisarlo antes de seguir.
2. 🟢 **Verde**
   - Escribir el mínimo código de producción para que pasen. Nada fuera de la tarea.
   - Correr de nuevo los tests de la tarea y después `npm test` completo.
3. 🔵 **Refactor**
   - Limpiar duplicación y nombres manteniendo el estilo del código vecino. `npm test` sigue en verde.
   - `npm run typecheck` y `npm run lint`.
4. Marcar la tarea como hecha en `tareas.md` y resumir: test(s) agregados, qué falló en rojo, qué se cambió.
   Proponer el mensaje de commit (`feat(<área>): …` / `fix(<área>): …`) pero **no commitear sin que el usuario lo pida**.

Nunca relajar ni borrar un test existente para que pase el nuevo: si un test viejo choca con la spec, frenar y
preguntar cuál de los dos manda.
