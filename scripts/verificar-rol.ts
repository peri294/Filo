// Aislamiento de roles (docs/roles/): cada commit declara su rol con una línea "Rol: <rol>" y solo puede tocar los
// archivos que docs/roles/permisos.json le permite a ese rol. Corre en el hook commit-msg y en el CI de cada PR.
//   tsx scripts/verificar-rol.ts --mensaje <archivo>   el commit que se está haciendo (hook)
//   tsx scripts/verificar-rol.ts --rango <base>..<head> todos los commits de un PR, sin contar merges (CI)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type Permisos = { roles: Record<string, { permitidos: string[]; prohibidos?: string[] }> };

const RUTA_PERMISOS = "docs/roles/permisos.json";

export function leerRol(mensaje: string): string | null {
  return mensaje.match(/^rol:[ \t]*(\S+)[ \t]*$/im)?.[1].toLowerCase() ?? null;
}

/** `**` = cualquier ruta, `*` y `?` no cruzan carpetas, `[...]` = un carácter del conjunto. */
function patronARegex(patron: string): RegExp {
  let re = "";
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === "*" && patron[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "[") {
      const fin = patron.indexOf("]", i);
      re += patron.slice(i, fin + 1);
      i = fin;
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function verificarRol(permisos: Permisos, rol: string, archivos: string[]): string[] {
  const reglas = permisos.roles[rol];
  if (!reglas) return [`El rol "${rol}" no existe. Roles válidos: ${Object.keys(permisos.roles).join(", ")}.`];
  const permitidos = reglas.permitidos.map(patronARegex);
  const prohibidos = (reglas.prohibidos ?? []).map(patronARegex);
  return archivos
    .map((a) => a.replaceAll("\\", "/"))
    .filter((a) => !permitidos.some((re) => re.test(a)) || prohibidos.some((re) => re.test(a)))
    .map((a) => `El rol "${rol}" no puede tocar ${a}.`);
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf-8" });
}

function lineas(texto: string) {
  return texto.split("\n").filter(Boolean);
}

function revisarCommit(permisos: Permisos, etiqueta: string, mensaje: string, archivos: string[]): string[] {
  const rol = leerRol(mensaje);
  if (!rol) return [`${etiqueta}: falta la línea "Rol: <rol>" en el mensaje (ver docs/roles/README.md).`];
  return verificarRol(permisos, rol, archivos).map((e) => `${etiqueta}: ${e}`);
}

function main(args: string[]) {
  const permisos: Permisos = JSON.parse(readFileSync(RUTA_PERMISOS, "utf-8"));
  const [modo, valor] = args;
  let errores: string[];

  if (modo === "--mensaje" && valor) {
    // Los merges (por ejemplo, traer main a la rama) no son trabajo de un rol.
    try {
      git("rev-parse", "-q", "--verify", "MERGE_HEAD");
      return;
    } catch {
      // No es un merge: se verifica.
    }
    const archivos = lineas(git("diff", "--cached", "--name-only"));
    errores = revisarCommit(permisos, "Este commit", readFileSync(valor, "utf-8"), archivos);
  } else if (modo === "--rango" && valor) {
    errores = lineas(git("rev-list", "--no-merges", valor)).flatMap((sha) =>
      revisarCommit(
        permisos,
        `Commit ${sha.slice(0, 7)}`,
        git("log", "-1", "--format=%B", sha),
        lineas(git("diff-tree", "--no-commit-id", "--name-only", "-r", sha)),
      ),
    );
  } else {
    console.error("Uso: verificar-rol.ts --mensaje <archivo> | --rango <base>..<head>");
    process.exit(2);
  }

  if (errores.length) {
    console.error(`Aislamiento de roles:\n${errores.map((e) => `  - ${e}`).join("\n")}`);
    console.error("Cada rol toca solo sus archivos (docs/roles/permisos.json). Separá el cambio en commits por rol.");
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
