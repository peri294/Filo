import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verificarSpecs } from "../scripts/verificar-specs";

let raiz: string;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "specs-"));
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

function escribir(ruta: string, contenido: string) {
  const completa = join(raiz, ruta);
  mkdirSync(dirname(completa), { recursive: true });
  writeFileSync(completa, contenido);
}

function spec(estado: string, { preguntas = "- [x] ¿Algo? Sí.", criterios = ["CA-1", "CA-2"] } = {}) {
  return [
    "# 999 · Algo",
    "",
    `- **Estado:** ${estado}`,
    "",
    "## Criterios de aceptación",
    "",
    ...criterios.map((ca) => `- **${ca}** — Dado … / Cuando … / Entonces …`),
    "",
    "## Preguntas abiertas",
    "",
    preguntas,
    "",
  ].join("\n");
}

function indice(estado: string) {
  return `| Nº | Spec | Estado |\n| --- | --- | --- |\n| 999 | [Algo](999-algo/spec.md) | ${estado} |\n`;
}

function armar(estado: string, opciones?: Parameters<typeof spec>[1], tareas = "- [x] **T1** — …\n") {
  escribir("docs/specs/README.md", indice(estado));
  escribir("docs/specs/999-algo/spec.md", spec(estado, opciones));
  escribir("docs/specs/999-algo/tareas.md", tareas);
}

describe("verificación de specs", () => {
  it("los ejemplos de este archivo no usan el número de una spec real", () => {
    // El verificador lee todos los tests, incluido este: un ejemplo con el número de una spec real la cubriría de mentira.
    const dirSpecs = join(__dirname, "..", "docs", "specs");
    const reales = existsSync(dirSpecs) ? readdirSync(dirSpecs).map((nombre) => nombre.slice(0, 3)) : [];
    const usados = [...readFileSync(__filename, "utf-8").matchAll(/\[(\d{3})-CA-\d+\]/g)].map((m) => m[1]);
    expect(usados.filter((numero) => reales.includes(numero))).toEqual([]);
  });

  it("sin specs no hay errores, y la plantilla no cuenta como spec", () => {
    escribir("docs/specs/README.md", "| Nº | Spec | Estado |\n");
    escribir("docs/specs/_plantilla/spec.md", spec("Borrador", { preguntas: "- [ ] …" }));
    expect(verificarSpecs(raiz)).toEqual([]);
  });

  it("un borrador puede tener preguntas abiertas", () => {
    armar("Borrador", { preguntas: "- [ ] ¿Algo?" }, "- [ ] **T1** — …\n");
    expect(verificarSpecs(raiz)).toEqual([]);
  });

  it("una spec aprobada no puede tener preguntas abiertas", () => {
    armar("Aprobada", { preguntas: "- [ ] ¿Algo?" });
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999-algo.*pregunta/i)]);
  });

  it("el estado tiene que ser uno de los válidos", () => {
    armar("Casi lista");
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999-algo.*estado/i)]);
  });

  it("el índice tiene que listar la spec con el mismo estado", () => {
    armar("Aprobada");
    escribir("docs/specs/README.md", indice("Borrador"));
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999.*índice/i)]);
  });

  it("una spec implementada necesita un test por criterio", () => {
    armar("Implementada");
    escribir("tests/algo.test.ts", 'it("[999-CA-1] hace algo", () => {});\n');
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999-algo.*CA-2/)]);
  });

  it("el test de un criterio de otra spec no cuenta", () => {
    armar("Implementada");
    escribir(
      "tests/algo.test.ts",
      'it("[999-CA-1] a", () => {});\nit("[998-CA-2] b", () => {});\nit("[CA-2] c", () => {});\n',
    );
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999-algo.*999-CA-2/)]);
  });

  it("una spec implementada no puede tener tareas sin marcar", () => {
    armar("Implementada", undefined, "- [x] **T1** — …\n- [ ] **T2** — …\n");
    escribir("tests/algo.test.ts", 'it("[999-CA-1] a", () => {});\nit("[999-CA-2] b", () => {});\n');
    expect(verificarSpecs(raiz)).toEqual([expect.stringMatching(/999-algo.*tarea/i)]);
  });

  it("una spec implementada con todo cubierto pasa", () => {
    armar("Implementada");
    escribir("tests/algo.test.ts", 'it("[999-CA-1] a", () => {});\nit("[999-CA-2] b", () => {});\n');
    expect(verificarSpecs(raiz)).toEqual([]);
  });
});
