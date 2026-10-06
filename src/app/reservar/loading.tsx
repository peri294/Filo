// Esqueleto mientras se cargan los servicios y los días disponibles.
export default function ReservarLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Cargando servicios y días disponibles…</span>
      <div aria-hidden className="space-y-4 motion-safe:animate-pulse">
        <div className="h-9 w-56 rounded-lg bg-surface-2" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-7 rounded-full bg-surface-2" />
              <div className="h-5 w-40 rounded bg-surface-2" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="h-16 rounded-xl bg-surface-2" />
              <div className="h-16 rounded-xl bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
