# Proceso: cerrar una spec

**Entrada:** el número de una spec (`NNN`).
**Salida:** la spec en estado `Implementada`, con todos los chequeos en verde, y el agente **frenado** esperando que
el dueño decida el merge.

1. Verificar que todas las tareas de `tareas.md` estén marcadas `- [x]`.
2. **Trazabilidad:** listar cada `CA-n` de `spec.md` y buscar en `tests/` el o los tests con `[NNN-CA-n]`. Mostrar una
   tabla `CA → test`. Si falta alguno, frenar: se agrega con el proceso `docs/procesos/tdd.md`.
3. Cambiar el estado a `Implementada` en `spec.md` y en `docs/specs/README.md`.
4. Correr `npm run check` (formato, typecheck, lint, specs, tests y build). `npm run specs` verifica solo la trazabilidad y los
   estados. Si algo falla, mostrar la salida y no seguir.
5. Comparar la spec con lo construido. Si difieren, actualizar la spec, o avisar si el que está mal es el código.
6. Verificar que lo construido no contradiga `docs/constitucion.md`. Si la spec traía una enmienda aprobada,
   confirmar que la versión y el registro de cambios de la constitución estén al día. Si cambió la ubicación de algo,
   actualizar `AGENTS.md` y/o `README.md`.
7. Anotar la sesión en la bitácora y proponer el commit o PR, **sin hacerlo hasta que el dueño lo pida**.
