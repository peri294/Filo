"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Navegadores viejos o sin permiso de portapapeles: intento clásico con un textarea temporal.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Botón para copiar al portapapeles. Sin `text`, copia el link de la página actual.
 * El resultado se anuncia en una región viva para lectores de pantalla.
 */
export function CopyButton({
  text,
  label,
  copiedLabel = "¡Copiado!",
  className = "btn-ghost",
}: {
  text?: string;
  label: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(id);
  }, [state]);

  async function onClick() {
    const ok = await copyText(text ?? window.location.origin + window.location.pathname);
    setState(ok ? "copied" : "failed");
  }

  const Icon = state === "copied" ? Check : text ? Copy : Link2;

  return (
    <>
      <button type="button" className={className} onClick={onClick}>
        <Icon className={`size-4 shrink-0 ${state === "copied" ? "text-ok" : ""}`} aria-hidden />
        {state === "copied" ? copiedLabel : state === "failed" ? "No se pudo copiar" : label}
      </button>
      <span className="sr-only" role="status">
        {state === "copied" ? copiedLabel : state === "failed" ? "No se pudo copiar. Copialo a mano." : ""}
      </span>
    </>
  );
}
