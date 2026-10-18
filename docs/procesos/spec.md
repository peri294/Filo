# Proceso: crear una spec

**Entrada:** una idea de funcionalidad o de cambio de comportamiento (la da el dueño).
**Salida:** `docs/specs/NNN-nombre/spec.md` en estado `Borrador`, y el agente **frenado** esperando aprobación.

1. Leer `docs/constitucion.md`, `docs/flujo-de-trabajo.md`, `docs/specs/README.md` y la plantilla
   `docs/specs/_plantilla/spec.md`.
2. Leer el código relacionado en `src/lib/*` para entender el comportamiento actual. La spec describe el cambio
   respecto de lo que hay, no un sistema imaginario.
3. Elegir el siguiente número libre (mirando `docs/specs/`) y un nombre corto en kebab-case:
   `docs/specs/NNN-nombre/`. Copiar ahí los tres archivos de `docs/specs/_plantilla/`.
4. Completar `spec.md`:
   - Problema, objetivo y **fuera de alcance** concretos.
   - Criterios de aceptación `CA-n` en Dado / Cuando / Entonces, cada uno verificable con un test de Vitest.
     Si aparece un recurso nuevo del panel, incluir siempre el aislamiento entre barberías y barberos (art. 3.1).
   - "Reglas que toca": citar los artículos de la constitución involucrados. Si la idea contradice alguno, decirlo
     claramente: la spec no se aprueba sin una enmienda, y la enmienda solo la aprueba el dueño.
   - Todo lo que no se pueda decidir con el código o con defaults razonables va a "Preguntas abiertas", como
     casillas `- [ ]`.
5. Agregar la fila al índice de `docs/specs/README.md` con estado `Borrador`.
6. Anotar la sesión en la bitácora de `tareas.md` (ver `docs/flujo-de-trabajo.md`, "Trabajo entre sesiones").
7. **No escribir código ni plan.** Mostrar al dueño un resumen de los criterios y las preguntas abiertas.
   Cuando las responda, volcar las respuestas en la spec (marcar `- [x]` y escribir la decisión). Cuando apruebe,
   cambiar el estado a `Aprobada` en `spec.md` y en el índice.
