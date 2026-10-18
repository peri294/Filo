# NNN · Plan técnico

Spec: [spec.md](spec.md)

## Enfoque

Cómo se resuelve, en pocas líneas. Alternativas descartadas y por qué.

## Cambios por capa

| Capa | Archivo | Cambio |
| --- | --- | --- |
| Base | `prisma/schema.prisma` + migración nueva | … |
| Lógica | `src/lib/…` | … |
| API | `src/app/api/…/route.ts` (valida con Zod y delega) | … |
| UI | `src/app/…` | … |
| Tests | `tests/….test.ts` (+ helpers en `tests/fixtures.ts`) | … |

## Datos y migración

Modelos/campos nuevos, índices o claves únicas que garantizan reglas en la base, qué pasa con los datos existentes.

## Seguridad y aislamiento

- Filtro por `tenantId` (y `barberId` si es barbero) en cada consulta nueva.
- Límites por IP / celular si hay algo que se pueda abusar.
- Qué responde ante recursos ajenos (404).

## Riesgos

Lo que puede salir mal y cómo se mitiga.
