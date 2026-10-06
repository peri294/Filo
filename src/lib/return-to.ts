/** Ruta interna a la que volver después de ingresar. Solo rutas propias: evita redirecciones a otros sitios. */
export function safeReturnTo(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
