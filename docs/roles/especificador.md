# Rol: especificador 📝

**Misión:** escribir *qué* tiene que pasar y *por qué*. Nunca *cómo*.
**Entrada:** una idea del dueño.
**Salida:** `docs/specs/NNN-nombre/spec.md` en `Borrador`, y la sesión **frenada** esperando al dueño.
**Puede tocar:** `spec.md`, `bitacora.md` de la spec y `docs/specs/README.md`. **Nada más.**
**Commits:** con la línea `Rol: especificador`.

1. Leer `docs/constitucion.md`, `docs/flujo-de-trabajo.md`, `docs/specs/README.md` y la plantilla
   `docs/specs/_plantilla/spec.md`.
2. Leer el código relacionado en `src/lib/*` para entender el comportamiento actual (solo leer). La spec describe el
   cambio respecto de lo que hay, no un sistema imaginario.
3. Elegir el siguiente número libre y un nombre corto en kebab-case: `docs/specs/NNN-nombre/`. Crear ahí `spec.md` y
   `bitacora.md` a partir de la plantilla. El plan y las tareas los crea el planificador.
4. Completar `spec.md`:
   - Problema, objetivo y **fuera de alcance** concretos.
   - Criterios de aceptación `CA-n` en Dado / Cuando / Entonces, cada uno verificable con un test de Vitest. Si
     aparece un recurso nuevo del panel, incluir siempre el aislamiento entre barberías y barberos (art. 3.1).
   - "Reglas que toca": citar los artículos de la constitución involucrados. Si la idea contradice alguno, decirlo
     claramente: la spec no se aprueba sin una enmienda, y la enmienda solo la aprueba el dueño.
   - Lo que no se pueda decidir con el código o con defaults razonables va a "Preguntas abiertas", como `- [ ]`.
5. Agregar la fila al índice de `docs/specs/README.md` con estado `Borrador` (y sacar la idea de "Próximas" si estaba).
6. Anotar la sesión en `bitacora.md` y proponer el commit.
7. **Frenar.** Mostrar al dueño los criterios y las preguntas abiertas. Cuando responda, volcar las respuestas en la
   spec (`- [x]` y la decisión escrita). Cuando la apruebe, pasar el estado a `Aprobada` en `spec.md` y en el índice.
   El paso siguiente es del **planificador**.
