# Proceso: planear una spec

**Entrada:** el número de una spec (`NNN`).
**Salida:** `plan.md` y `tareas.md` completos en `docs/specs/NNN-*/`, y el agente **frenado** esperando revisión.

1. Leer `docs/specs/NNN-*/spec.md`. Si no está `Aprobada` o le quedan preguntas abiertas `- [ ]`, **frenar** y
   decirlo.
2. Leer `docs/constitucion.md`, `docs/flujo-de-trabajo.md`, la sección "Dónde está cada cosa" de `AGENTS.md` y el
   código que se va a tocar. Ante dudas de Next.js 16, leer `node_modules/next/dist/docs/`.
3. Escribir `plan.md` siguiendo la plantilla: enfoque y alternativas descartadas, cambios por capa (lógica en
   `src/lib`, rutas delgadas con Zod), migración nueva si hace falta, aislamiento por `tenantId`/`barberId`,
   límites anti-abuso y riesgos.
4. Escribir `tareas.md` siguiendo la plantilla: tareas chicas y ordenadas (`T1`, `T2`…), cada una con los `CA-n`
   que cubre y el test concreto (archivo + nombre `"[NNN-CA-n] …"`). Primero la lógica testeable, después la API y al
   final la UI. **Todo `CA-n` de la spec tiene que quedar cubierto por al menos una tarea.**
5. Anotar la sesión en la bitácora de `tareas.md`.
6. **No implementar.** Mostrar al dueño el plan resumido y la lista de tareas para que los revise.
