import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/format";

describe("normalizePhone", () => {
  it.each([
    ["11 2345-6789", "5491123456789"],
    ["+54 9 11 2345 6789", "5491123456789"],
    ["011 15 2345 6789", "5491123456789"],
    ["5491123456789", "5491123456789"],
    ["+54 11 2345 6789", "5491123456789"],
    ["0054 9 11 2345 6789", "5491123456789"],
    ["(011) 2345-6789", "5491123456789"],
    ["0351 15 123 4567", "5493511234567"],
    ["351 123 4567", "5493511234567"],
    ["+54 9 351 123-4567", "5493511234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("todas las formas de escribir el mismo celular de Buenos Aires dan el mismo resultado", () => {
    const formas = ["11 2345-6789", "+54 9 11 2345 6789", "011 15 2345 6789", "5491123456789"];
    const resultados = new Set(formas.map(normalizePhone));
    expect([...resultados]).toEqual(["5491123456789"]);
  });

  it("formato 549 + 10 dígitos", () => {
    expect(normalizePhone("0351 15 123 4567")).toMatch(/^549\d{10}$/);
  });

  it.each(["123", "", "   ", "abc", "1234567890123456", "0000000000"])("%j no es válido → null", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
