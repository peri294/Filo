"use client"; // Reemplaza al layout raíz cuando falla él mismo (por ejemplo, si no responde la base).

import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-AR">
      <body className="grid min-h-dvh place-items-center bg-bg px-4 font-sans text-ink antialiased">
        <title>Algo falló · Turnos online</title>
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-semibold uppercase">No pudimos cargar la página</h1>
          <p className="mt-3 text-muted">Fue un problema nuestro. Probá de nuevo en unos segundos.</p>
          <button type="button" className="btn-primary mt-6 w-full" onClick={() => retry()}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
