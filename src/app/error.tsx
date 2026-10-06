"use client"; // Los error boundaries tienen que ser Client Components.

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon={TriangleAlert}
      eyebrow="Algo falló"
      title="No pudimos cargar esta página"
      actions={
        <>
          <button type="button" className="btn-primary" onClick={() => retry()}>
            <RotateCcw className="size-5" aria-hidden /> Reintentar
          </button>
          <Link href="/" className="btn-ghost">
            Ir al inicio
          </Link>
        </>
      }
    >
      <p>Fue un problema nuestro, no tuyo. Probá de nuevo en unos segundos.</p>
      <p className="text-sm">Si ya habías reservado, tu turno sigue guardado.</p>
      {error.digest && <p className="text-xs">Código del error: {error.digest}</p>}
    </StatusScreen>
  );
}
