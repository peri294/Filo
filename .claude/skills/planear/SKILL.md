---
name: planear
description: Arma plan.md y tareas.md para una spec aprobada de docs/specs (SDD), con tareas chicas listas para TDD.
argument-hint: <número de spec, ej. 001>
disable-model-invocation: true
---

Planificar la spec **$ARGUMENTS** (carpeta `docs/specs/$ARGUMENTS-*/`).

1. Leer `spec.md`. Si no está `Aprobada` o tiene preguntas abiertas sin responder, frenar y decirlo.
2. Leer `docs/flujo-de-trabajo.md`, `docs/constitucion.md`, "Dónde está cada cosa" de `CLAUDE.md` y el código que se va a tocar.
   Ante dudas de Next.js 16, leer `node_modules/next/dist/docs/`.
3. Escribir `plan.md` desde `docs/specs/_plantilla/plan.md`: enfoque, cambios por capa (lógica en `src/lib`, rutas
   delgadas con Zod), migración si hace falta, aislamiento por `tenantId`/`barberId`, límites anti-abuso, riesgos.
4. Escribir `tareas.md` desde la plantilla: tareas chicas y ordenadas (`T1`, `T2`…), cada una con los `CA-*` que
   cubre y el test concreto (archivo + nombre `"[CA-n] …"`). Primero la lógica testeable, después API, al final UI.
   Todo `CA-*` de la spec tiene que quedar cubierto por al menos una tarea.
5. No implementar. Mostrar el plan resumido y la lista de tareas para que el usuario la revise.
