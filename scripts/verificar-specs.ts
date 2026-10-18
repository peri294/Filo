// Verifica las specs de docs/specs contra el flujo SDD + TDD (docs/flujo-de-trabajo.md):
// estados válidos, índice al día, sin preguntas abiertas al aprobar y, al implementar,
// todas las tareas marcadas y un test "[NNN-CA-n]" por cada criterio. Corre en `npm run check`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ESTADOS = ["Borrador", "Aprobada", "Implementada", "Descartada"];
const SIN_PREGUNTAS = ["Aprobada", "Implementada"];

function leer(ruta: string) {
  return existsSync(ruta) ? readFileSync(ruta, "utf-8") : "";
}

/** Texto de una sección "## Título" hasta la siguiente "## ". */
function seccion(md: string, titulo: string) {
  const inicio = md.search(new RegExp(`^## ${titulo}\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = md.slice(inicio).split("\n").slice(1).join("\n");
  const fin = resto.search(/^## /m);
  return fin < 0 ? resto : resto.slice(0, fin);
}

function archivosDeTest(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivosDeTest(ruta);
    return e.name.endsWith(".test.ts") ? [ruta] : [];
  });
}

export function verificarSpecs(raiz: string): string[] {
  const dirSpecs = join(raiz, "docs", "specs");
  if (!existsSync(dirSpecs)) return [];
  const errores: string[] = [];
  const indice = leer(join(dirSpecs, "README.md"));
  const tests = archivosDeTest(join(raiz, "tests")).map(leer).join("\n");

  const carpetas = readdirSync(dirSpecs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
    .map((e) => e.name)
    .sort();

  for (const carpeta of carpetas) {
    const spec = leer(join(dirSpecs, carpeta, "spec.md"));
    const estado = spec.match(/^- \*\*Estado:\*\*\s*([^\s<]+)/m)?.[1];
    if (!estado || !ESTADOS.includes(estado)) {
      errores.push(`${carpeta}: estado "${estado ?? "(falta)"}" inválido; tiene que ser ${ESTADOS.join(", ")}.`);
      continue;
    }

    const numero = carpeta.slice(0, 3);
    const fila = indice.split("\n").find((l) => new RegExp(`^\\|\\s*${numero}\\s*\\|`).test(l));
    if (!fila?.split("|").some((celda) => celda.trim() === estado)) {
      errores.push(`${numero}: el índice docs/specs/README.md no la lista con estado "${estado}".`);
    }

    if (SIN_PREGUNTAS.includes(estado) && /^\s*- \[ \]/m.test(seccion(spec, "Preguntas abiertas"))) {
      errores.push(`${carpeta}: está "${estado}" pero le quedan preguntas abiertas sin responder.`);
    }

    if (estado !== "Implementada") continue;

    if (/^\s*- \[ \]/m.test(leer(join(dirSpecs, carpeta, "tareas.md")))) {
      errores.push(`${carpeta}: está "Implementada" pero tiene tareas sin marcar en tareas.md.`);
    }
    const criterios = [...new Set([...spec.matchAll(/\*\*(CA-\d+)\*\*/g)].map((m) => m[1]))];
    for (const ca of criterios) {
      const id = `${numero}-${ca}`;
      if (!tests.includes(`[${id}]`))
        errores.push(`${carpeta}: ${ca} no tiene ningún test con "[${id}]" en el nombre.`);
    }
  }
  return errores;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const errores = verificarSpecs(process.cwd());
  if (errores.length) {
    console.error(`Specs con problemas:\n${errores.map((e) => `  - ${e}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Specs en orden.");
}
