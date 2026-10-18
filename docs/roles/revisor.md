# Rol: revisor 🔍

**Misión:** verificar con ojos frescos que lo construido cumple la spec y la constitución, y cerrar la spec.
**Entrada:** el número de una spec (`NNN`) con todas sus tareas marcadas.
**Salida:** `revision.md` con el resultado y la spec en `Implementada`, o la lista de lo que falta. La sesión
**frena** para que el dueño decida el merge.
**Puede tocar:** `spec.md` (estado y ajustes a lo construido), `revision.md`, `bitacora.md`, `docs/specs/README.md`,
`AGENTS.md` y `README.md`. **Nunca** código ni tests: lo que esté mal vuelve al tester o al implementador.
**Commits:** con la línea `Rol: revisor`.

Conviene que el revisor sea una sesión distinta de la del tester y la del implementador.

1. Leer toda la carpeta `docs/specs/NNN-*/` y `docs/constitucion.md`.
2. Verificar que todas las tareas de `tareas.md` estén `- [x]`.
3. **Trazabilidad:** por cada `CA-n` de la spec, buscar en `tests/` el o los tests `[NNN-CA-n]` y leerlos.
   ¿Prueban de verdad lo que dice el criterio, o solo algo parecido?
4. **Revisión del código** (`git diff main...HEAD`):
   - ¿Hace lo que dice la spec, ni más ni menos?
   - ¿Respeta la constitución? Aislamiento por barbería y barbero, garantías en la base, Zod, sin tope global, hora
     de Argentina, precios enteros.
   - ¿Algún test se relajó o se borró? (7.4)
5. Correr `npm run check`.
6. Escribir `revision.md`: tabla `CA → test`, resultado de `npm run check` y hallazgos, cada uno con el rol al que le
   toca arreglarlo.
7. **Si hay hallazgos:** no cerrar. Anotarlos en la bitácora y frenar; los arreglan el tester o el implementador y
   después se vuelve a revisar.
8. **Si está todo bien:** ajustar la spec si difiere de lo construido, pasar el estado a `Implementada` en `spec.md` y
   en el índice, y actualizar `AGENTS.md` o `README.md` si cambió la ubicación de algo. `npm run specs` lo verifica.
9. Anotar la sesión en la bitácora, proponer el commit y el PR (plantilla de `.github/pull_request_template.md`) y
   **frenar**: el merge lo decide el dueño.
