# NNN · Título de la funcionalidad

- **Estado:** Borrador <!-- Borrador | Aprobada | Implementada | Descartada -->
- **Fecha:** AAAA-MM-DD
- **Roles afectados:** Cliente / Admin / Barbero / Superadmin

## Problema

Qué pasa hoy y por qué es un problema. Para quién. (2-5 líneas, sin hablar de código.)

## Objetivo

Qué cambia para el usuario cuando esto esté hecho.

## Fuera de alcance

Lo que explícitamente **no** se hace en esta spec (para que no crezca sola).

## Historias

- Como **cliente**, quiero … para …
- Como **admin**, quiero … para …

## Criterios de aceptación

Cada uno con ID estable; el test que lo prueba lleva el ID en su nombre junto con el número de spec (`it("[NNN-CA-1] …")`).

- **CA-1** — Dado … / Cuando … / Entonces …
- **CA-2** — Dado … / Cuando … / Entonces …

Casos borde a cubrir (convertir en criterios si importan):
- Otra barbería / otro barbero intenta acceder → 404.
- Límites de tiempo (vencimientos, 24 h, anticipación mínima).
- Datos inválidos.

## Reglas que toca

Artículos de [`docs/constitucion.md`](../../constitucion.md) que esta spec toca o pone en riesgo (ej. "3.1 aislamiento:
el recurso nuevo filtra por `tenantId`"). Si **contradice** alguno, la spec no se aprueba hasta que el dueño enmiende
la constitución. Si no toca ninguno en especial, escribir "Ninguno".

## Textos de UI

Mensajes y errores nuevos, en español rioplatense (vos).

## Preguntas abiertas

- [ ] … (con preguntas sin responder no se pasa al plan)
