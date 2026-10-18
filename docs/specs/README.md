# Specs

Una carpeta por funcionalidad o cambio de comportamiento, numerada: `NNN-nombre-corto/` con `spec.md`, `plan.md`,
`tareas.md`, `bitacora.md` y `revision.md`. Cada archivo lo escribe un rol distinto
([`../roles/`](../roles/README.md)), a partir de las plantillas de [`_plantilla/`](_plantilla/). El flujo completo está en [`../flujo-de-trabajo.md`](../flujo-de-trabajo.md).

| Nº | Spec | Estado |
| --- | --- | --- |
| — | _(todavía no hay specs)_ | — |

## Próximas

Ideas anotadas, todavía sin spec. Cuando el dueño decide arrancar una, se crea con el proceso de spec y sale de esta
lista.

- **PostgreSQL en producción** (constitución 5.2). SQLite sigue en desarrollo y tests. Pregunta para la spec:
  ¿los tests también corren contra Postgres?
- **Datos personales** (constitución 5.4, pendiente): si el cliente puede borrar su cuenta y cuánto tiempo se guarda
  el historial. Es una decisión del dueño que entra como enmienda antes de cualquier spec.
- **Mercado Pago** (constitución 8.3): no se toca hasta que el dueño lo decida.
