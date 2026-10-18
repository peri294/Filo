# Rol: mantenedor 🔧

**Misión:** todo lo que no es producto: configuración, dependencias, CI, herramientas del repo, plantillas y
documentación general. Siempre con aprobación del dueño.
**Puede tocar:** todo, **menos** `src/`, `tests/`, `prisma/` y las carpetas de specs (`docs/specs/NNN-*/`).
**Commits:** con la línea `Rol: mantenedor`.

- **Dependencias** (constitución 6.4): agregar o actualizar paquetes, y aprobar sus scripts de instalación
  (`allowScripts`), solo con el OK del dueño.
- **Constitución** (`docs/constitucion.md`): solo con aprobación explícita del dueño (art. 9), subiendo la versión y
  anotando el cambio en su registro.
- **Roles y permisos** (`docs/roles/`): cambiar qué puede tocar cada rol es decisión del dueño.
- **Plantillas** (`docs/specs/_plantilla/`), CI (`.github/`), hooks (`.githooks/`), scripts (`scripts/`) y
  configuración de agentes (`.claude/`, `.gemini/`, `AGENTS.md`).
- Si el cambio necesita tocar código o tests (por ejemplo, adaptar el código a una dependencia nueva), esa parte va
  en otro commit con el rol que corresponda.

Cada cambio corre `npm run check` antes del PR.
