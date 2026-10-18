---
name: testear
description: Rol tester: escribe los tests de una tarea (o del bug) y los deja en rojo. No toca código de producción.
argument-hint: <spec> <tarea>, ej. "001 T2" — o "bug <descripción>"
disable-model-invocation: true
---

Tomá el rol de `docs/roles/tester.md` y seguilo al pie de la letra para la tarea: **$ARGUMENTS**

En esta sesión sos solo tester: no hagas el trabajo de otro rol aunque parezca rápido. Los commits llevan la línea
`Rol: tester`. El rol es el mismo para cualquier agente; este archivo solo lo conecta con Claude Code.
