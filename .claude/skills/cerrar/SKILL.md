---
name: cerrar
description: Cierra una spec de docs/specs verificando que cada criterio tenga test, que pasen todos los chequeos y que la documentación quede al día.
argument-hint: <número de spec, ej. 001>
disable-model-invocation: true
---

Cerrar la spec **$ARGUMENTS** (carpeta `docs/specs/$ARGUMENTS-*/`).

1. Verificar que todas las tareas de `tareas.md` estén marcadas.
2. Trazabilidad: listar cada `CA-*` de `spec.md` y buscar en `tests/` el/los test(s) con ese ID. Informar en una tabla
   `CA → test`. Si falta alguno, frenar: hay que agregarlo con `/tdd`.
3. Correr `npm run check` (typecheck, lint, tests y build). Si algo falla, mostrar la salida y no seguir.
4. Comparar la spec con lo construido; si difieren, actualizar la spec (o avisar si el código es el que está mal).
5. Verificar que lo construido no contradiga `docs/constitucion.md`. Si la spec traía una enmienda aprobada, confirmar
   que la versión y el registro de cambios de la constitución estén al día. Si cambió la ubicación de algo,
   actualizar `CLAUDE.md` y/o `README.md`.
6. Estado de la spec → `Implementada` (en `spec.md` y en `docs/specs/README.md`).
7. Resumir y proponer el commit/PR, sin hacerlo hasta que el usuario lo pida.
