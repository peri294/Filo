# Roles

El trabajo se reparte en roles aislados. **Cada sesión de un agente toma un solo rol**, hace su parte, la deja
escrita en el repo y frena. La siguiente sesión, del mismo agente o de otro (Claude, Gemini, Grok…), toma el rol que
sigue. El tester y el implementador de una misma tarea **son sesiones distintas** (constitución 7.7), idealmente de
agentes distintos: así el código no se escribe "a medida" de los tests.

```
 dueño: idea
   │
   ▼
 📝 especificador ──► [dueño aprueba la spec]
   │
   ▼
 🗺️ planificador ──► [dueño revisa el plan]
   │
   ▼   por cada tarea:
 🔴 tester (tests en rojo) ──► 🟢 implementador (código en verde + refactor)
   │
   ▼
 🔍 revisor ──► [dueño decide el merge]
```

| Rol | Hace | Puede tocar | Documento |
| --- | --- | --- | --- |
| 📝 especificador | La spec: qué y por qué | `spec.md`, índice de specs | [especificador.md](especificador.md) |
| 🗺️ planificador | Plan y tareas | `plan.md`, `tareas.md` | [planificador.md](planificador.md) |
| 🔴 tester | Tests de una tarea, en rojo | `tests/` | [tester.md](tester.md) |
| 🟢 implementador | Código que hace pasar los tests | `src/`, `prisma/`, marcar tareas | [implementador.md](implementador.md) |
| 🔍 revisor | Verifica y cierra la spec | `spec.md`, `revision.md`, índice, `AGENTS.md`, `README.md` | [revisor.md](revisor.md) |
| 🔧 mantenedor | Configuración, dependencias, CI, docs generales | Todo menos código, tests y specs | [mantenedor.md](mantenedor.md) |

Todos los roles pueden escribir la **bitácora** de la spec (`docs/specs/NNN-*/bitacora.md`). La lista exacta de
archivos por rol está en [`permisos.json`](permisos.json).

## Cómo se controla

- **Cada commit declara su rol** con una línea propia en el mensaje: `Rol: tester`.
- El **hook `commit-msg`** rechaza el commit si falta el rol o si toca archivos que no son de ese rol.
- El **CI** revisa lo mismo en todos los commits del PR, así que no alcanza con saltearse el hook.
- Si un cambio necesita archivos de dos roles, son **dos commits**, y en general dos sesiones.

Ejemplo de mensaje:

```
test(booking): 001-CA-2 el cliente no cancela con menos de 24 h

Rol: tester
```

## Cómo se toma un rol

| Agente | Cómo |
| --- | --- |
| Claude Code | `/especificar`, `/planear`, `/testear`, `/implementar`, `/revisar`, o los subagentes de `.claude/agents/` |
| Gemini CLI | Los mismos comandos (`.gemini/commands/`) |
| Cualquier otro | *"Tomá el rol de `docs/roles/tester.md` para la tarea 001 T2"* |

## Sin spec

- **Bug:** el tester escribe el test que lo reproduce (rojo) y el implementador lo arregla (verde).
- **Refactor sin cambio de comportamiento:** implementador, con los tests en verde y sin tocarlos.
- **Configuración, dependencias, CI o documentación general:** mantenedor, con aprobación del dueño.
