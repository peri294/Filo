---
name: spec
description: Crea una spec nueva (SDD) en docs/specs a partir de una idea de funcionalidad. Usar cuando se pide una funcionalidad o cambio de comportamiento nuevo antes de escribir código.
argument-hint: <descripción de la funcionalidad>
disable-model-invocation: true
---

Crear la spec para: **$ARGUMENTS**

1. Leer `docs/flujo-de-trabajo.md`, `docs/specs/README.md`, la plantilla `docs/specs/_plantilla/spec.md` y `docs/constitucion.md`.
2. Leer el código relacionado en `src/lib/*` para entender el comportamiento actual (la spec describe el cambio
   respecto de lo que hay, no un sistema imaginario).
3. Elegir el siguiente número libre y un nombre corto en kebab-case: `docs/specs/NNN-nombre/spec.md`.
4. Completar la plantilla:
   - Problema, objetivo y **fuera de alcance** concretos.
   - Criterios de aceptación `CA-n` en Dado / Cuando / Entonces, cada uno verificable con un test de Vitest.
     Incluir siempre el aislamiento entre barberías/barberos si aparece un recurso nuevo del panel.
   - "Reglas que toca": citar los artículos de la constitución involucrados. Si la idea contradice alguno, decirlo
     claramente: la spec no se aprueba sin una enmienda, y la enmienda solo la aprueba el dueño.
   - Todo lo que no se pueda decidir con el código o con defaults razonables va a "Preguntas abiertas".
5. Agregar la fila al índice de `docs/specs/README.md` con estado `Borrador`.
6. **No escribir código ni plan.** Mostrar un resumen de los criterios y las preguntas abiertas y pedir al usuario que
   las responda o apruebe la spec. Al aprobarse, cambiar el estado a `Aprobada`.
