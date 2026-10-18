import { describe, expect, it } from "vitest";
import { leerRol, verificarRol, type Permisos } from "../scripts/verificar-rol";

const permisos: Permisos = {
  roles: {
    tester: { permitidos: ["tests/**", "docs/specs/[0-9][0-9][0-9]-*/bitacora.md"] },
    implementador: { permitidos: ["src/**", "docs/specs/[0-9][0-9][0-9]-*/tareas.md"] },
    mantenedor: { permitidos: ["**"], prohibidos: ["src/**", "tests/**", "docs/specs/[0-9][0-9][0-9]-*/**"] },
  },
};

describe("rol declarado en el mensaje del commit", () => {
  it("lee la línea 'Rol:' sin importar mayúsculas ni espacios", () => {
    expect(leerRol("feat: algo\n\nRol: Implementador\nCo-Authored-By: X <x@y.z>\n")).toBe("implementador");
    expect(leerRol("test: algo\n\nrol:   tester  \n")).toBe("tester");
  });

  it("sin línea 'Rol:' devuelve null", () => {
    expect(leerRol("feat: algo\n\nque menciona el rol: en el medio de una frase\n")).toBeNull();
  });
});

describe("archivos permitidos por rol", () => {
  it("un rol que no existe es un error", () => {
    expect(verificarRol(permisos, "hacker", ["src/a.ts"])).toEqual([expect.stringMatching(/hacker.*no existe/i)]);
  });

  it("el tester solo toca tests y la bitácora", () => {
    expect(verificarRol(permisos, "tester", ["tests/a.test.ts", "docs/specs/001-algo/bitacora.md"])).toEqual([]);
    expect(verificarRol(permisos, "tester", ["tests/a.test.ts", "src/lib/a.ts"])).toEqual([
      expect.stringMatching(/tester.*src\/lib\/a\.ts/),
    ]);
  });

  it("el implementador no puede tocar los tests", () => {
    expect(verificarRol(permisos, "implementador", ["src/lib/a.ts", "tests/a.test.ts"])).toEqual([
      expect.stringMatching(/implementador.*tests\/a\.test\.ts/),
    ]);
  });

  it("'*' no cruza carpetas y '[0-9]' exige dígitos: la plantilla no es una spec", () => {
    expect(verificarRol(permisos, "implementador", ["docs/specs/001-algo/tareas.md"])).toEqual([]);
    expect(verificarRol(permisos, "implementador", ["docs/specs/_plantilla/tareas.md"])).toHaveLength(1);
    expect(verificarRol(permisos, "implementador", ["docs/specs/001-algo/sub/tareas.md"])).toHaveLength(1);
  });

  it("los prohibidos ganan sobre los permitidos", () => {
    expect(verificarRol(permisos, "mantenedor", ["package.json", ".github/workflows/check.yml"])).toEqual([]);
    expect(verificarRol(permisos, "mantenedor", ["docs/specs/_plantilla/spec.md"])).toEqual([]);
    expect(verificarRol(permisos, "mantenedor", ["src/a.ts", "docs/specs/001-algo/spec.md"])).toHaveLength(2);
  });

  it("los archivos de Windows con barra invertida se comparan igual", () => {
    expect(verificarRol(permisos, "tester", ["tests\\a.test.ts"])).toEqual([]);
  });
});
