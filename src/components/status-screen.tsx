import type { LucideIcon } from "lucide-react";

/** Pantalla centrada para estados especiales (no encontrado, error). Mismo estilo que el resto del sitio. */
export function StatusScreen({
  icon: Icon,
  eyebrow,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface">
        <Icon className="size-6 text-brass" aria-hidden />
      </span>
      <p className="mt-5 text-sm tracking-[0.3em] text-brass uppercase">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl uppercase">{title}</h1>
      <div className="mt-3 space-y-2 text-muted">{children}</div>
      <div className="mt-6 flex flex-col gap-3">{actions}</div>
    </div>
  );
}
