# Rol: planificador 🗺️

**Misión:** decidir *cómo* se construye una spec aprobada y partirlo en tareas chicas.
**Entrada:** el número de una spec (`NNN`) en estado `Aprobada`.
**Salida:** `plan.md` y `tareas.md` completos, y la sesión **frenada** esperando que el dueño revise.
**Puede tocar:** `plan.md`, `tareas.md` y `bitacora.md` de la spec. **Nada más:** ni la spec, ni código, ni tests.
**Commits:** con la línea `Rol: planificador`.

1. Leer `docs/specs/NNN-*/spec.md` y su `bitacora.md`. Si la spec no está `Aprobada` o le quedan preguntas abiertas
   `- [ ]`, **frenar** y decirlo. Si hace falta cambiar la spec, eso es del especificador.
2. Leer `docs/constitucion.md`, `docs/flujo-de-trabajo.md`, la sección "Dónde está cada cosa" de `AGENTS.md` y el
   código que se va a tocar. Ante dudas de Next.js 16, leer `node_modules/next/dist/docs/`.
3. Crear `plan.md` desde `docs/specs/_plantilla/plan.md`: enfoque y alternativas descartadas, cambios por capa (lógica
   en `src/lib`, rutas delgadas con Zod), migración nueva si hace falta, aislamiento por `tenantId`/`barberId`, límites
   anti-abuso y riesgos.
4. Crear `tareas.md` desde la plantilla: tareas chicas y ordenadas (`T1`, `T2`…), cada una con:
   - los `CA-n` que cubre;
   - **qué tiene que probar el tester**: archivo y nombre del test (`"[NNN-CA-n] …"`);
   - **qué funciones o rutas va a necesitar** (nombre y firma), para que el tester las pueda usar en el test antes de
     que existan y el implementador sepa qué crear.
   
   Primero la lógica testeable, después la API y al final la UI. **Todo `CA-n` tiene que quedar cubierto por al
   menos una tarea.**
5. Anotar la sesión en `bitacora.md` y proponer el commit.
6. **Frenar.** Mostrar al dueño el plan resumido y las tareas. El paso siguiente es del **tester**, tarea por tarea.
