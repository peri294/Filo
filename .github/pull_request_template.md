## Qué cambia

<!-- Una o dos líneas: qué hace este PR y por qué. -->

## Spec

<!-- Link a docs/specs/NNN-*/spec.md, o "Sin spec" y por qué (textos, estilos, refactor, dependencias, bug con test). -->

## Checklist

- [ ] Si cambia comportamiento: tiene spec `Aprobada` y sus tareas están marcadas en `tareas.md`.
- [ ] Cada criterio `CA-n` tiene su test `[NNN-CA-n]` (o el bug tiene un test que lo reproduce).
- [ ] No se relajó ni se borró ningún test para que pase otro (constitución 7.4).
- [ ] No contradice `docs/constitucion.md`. Si la enmienda, el dueño la aprobó y la versión está actualizada.
- [ ] Cada commit tiene su línea `Rol: …` y toca solo los archivos de ese rol (el CI lo verifica).
- [ ] El tester y el implementador de cada tarea fueron sesiones distintas.
- [ ] La bitácora de la spec (`bitacora.md`) está al día y, si hay spec, el revisor dejó `revision.md`.
- [ ] `npm run check` en verde en local. El CI lo vuelve a correr.

## Roles y agentes

<!-- Qué agente hizo cada rol: ej. "especificador: Claude Opus 5.5 · tester: Gemini · implementador: Grok · revisor: Claude". -->
