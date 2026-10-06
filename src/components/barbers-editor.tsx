"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, Plus } from "lucide-react";
import { ActionButton, request } from "@/components/admin-controls";
import { FormMessage } from "@/components/admin-config-forms";
import { WeekHoursFields, weekRowsFrom, weekRowsPayload, type WeekRows } from "@/components/week-hours";
import { describeWeek } from "@/lib/schedule";

export type BarberValues = {
  id: string;
  name: string;
  weeklyHours: string | null;
  sortOrder: number;
  active: boolean;
  appointmentCount: number;
  user: { phone: string; role: string; active: boolean } | null;
  isMe: boolean;
};

type Draft = { name: string; sortOrder: string; ownHours: boolean; hours: WeekRows };

function BarberForm({
  initial,
  unit,
  submitLabel,
  extra,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  unit: number;
  submitLabel: string;
  extra?: React.ReactNode;
  onSubmit: (d: Draft) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefix = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await onSubmit(draft);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <label htmlFor={`${prefix}-name`} className="label">Nombre</label>
          <input
            id={`${prefix}-name`}
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={60}
            required
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-order`} className="label">Orden</label>
          <input
            id={`${prefix}-order`}
            type="number"
            inputMode="numeric"
            className="input"
            min={0}
            value={draft.sortOrder}
            onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
            required
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-brass)]"
          checked={draft.ownHours}
          onChange={(e) => setDraft({ ...draft, ownHours: e.target.checked })}
        />
        Tiene su propio horario (si no, trabaja todo el horario del local)
      </label>
      {draft.ownHours && (
        <WeekHoursFields
          value={draft.hours}
          onChange={(hours) => setDraft({ ...draft, hours })}
          unit={unit}
          legend="Días y horarios en que atiende (dentro del horario del local)"
          idPrefix={prefix}
        />
      )}
      {extra}
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function payload(d: Draft) {
  return { name: d.name, sortOrder: Number(d.sortOrder), weeklyHours: d.ownHours ? weekRowsPayload(d.hours) : null };
}

/** Crear el usuario del barbero o asignarle una clave nueva. */
function AccessForm({ barber, onDone }: { barber: BarberValues; onDone: () => void }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefix = useId();
  const hasUser = !!barber.user;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await request(`/api/panel/barberos/${barber.id}/acceso`, "POST", { phone, password });
    setBusy(false);
    if (err) return setError(err);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-3">
      <p className="text-sm text-muted">
        {hasUser
          ? "Clave nueva para su usuario. Usalo solo si no puede recuperarla por SMS: se le cierran las sesiones abiertas."
          : "Con un usuario, el barbero entra al panel y ve su agenda y sus métricas."}
      </p>
      {!hasUser && (
        <div>
          <label htmlFor={`${prefix}-phone`} className="label">Celular del barbero</label>
          <input
            id={`${prefix}-phone`}
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="11 2345 6789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      )}
      <div>
        <label htmlFor={`${prefix}-pass`} className="label">{hasUser ? "Clave nueva" : "Clave inicial"}</label>
        <input
          id={`${prefix}-pass`}
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="hint">Mínimo 8 caracteres. Pasásela en persona; después la puede cambiar con &quot;Olvidé mi contraseña&quot;.</p>
      </div>
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {hasUser ? "Cambiar clave" : "Crear usuario"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BarberItem({ barber, unit, localHours }: { barber: BarberValues; unit: number; localHours: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "access">("view");

  if (mode === "edit") {
    return (
      <li className="rounded-xl bg-surface-2 p-4">
        <BarberForm
          unit={unit}
          submitLabel="Guardar"
          initial={{
            name: barber.name,
            sortOrder: String(barber.sortOrder),
            ownHours: barber.weeklyHours !== null,
            hours: weekRowsFrom(barber.weeklyHours ?? localHours),
          }}
          onCancel={() => setMode("view")}
          onSubmit={async (d) => {
            const err = await request(`/api/panel/barberos/${barber.id}`, "PATCH", payload(d));
            if (!err) {
              setMode("view");
              router.refresh();
            }
            return err;
          }}
        />
      </li>
    );
  }

  const schedule = barber.weeklyHours ? describeWeek(barber.weeklyHours) : null;
  return (
    <li className={`space-y-3 rounded-xl bg-surface-2 p-3 ${barber.active ? "" : "opacity-70"}`}>
      <div className="text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {barber.name}
          {barber.isMe && <span className="rounded-full border border-brass/60 px-2 py-0.5 text-xs text-brass">Vos</span>}
          {!barber.active && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Inactivo</span>}
        </p>
        <p className="text-muted">{schedule ? schedule.join(" · ") || "Sin días de atención" : "Horario del local"}</p>
        <p className="text-xs text-muted">
          {barber.user ? `Entra al panel con +${barber.user.phone}` : "Sin usuario para el panel"} · {barber.appointmentCount} turnos
        </p>
      </div>
      {mode === "access" ? (
        <AccessForm barber={barber} onDone={() => setMode("view")} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setMode("edit")}>
            <Pencil className="size-4" aria-hidden /> Editar
          </button>
          {!barber.isMe && (
            <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setMode("access")}>
              <KeyRound className="size-4" aria-hidden /> {barber.user ? "Nueva clave" : "Darle acceso"}
            </button>
          )}
          <ActionButton
            url={`/api/panel/barberos/${barber.id}`}
            method="PATCH"
            body={{ active: !barber.active }}
            className={barber.active ? "btn-ghost px-3 py-2 text-sm" : "btn-primary px-3 py-2 text-sm"}
            confirmText={barber.active ? "¿Dar de baja?" : undefined}
          >
            {barber.active ? "Dar de baja" : "Reactivar"}
          </ActionButton>
          {barber.appointmentCount === 0 && !barber.isMe && (
            <ActionButton url={`/api/panel/barberos/${barber.id}`} method="DELETE" className="btn-danger px-3 py-2 text-sm" confirmText="¿Borrar?">
              Borrar
            </ActionButton>
          )}
        </div>
      )}
    </li>
  );
}

export function BarbersEditor({
  barbers,
  unit,
  localHours,
  canAddMe,
}: {
  barbers: BarberValues[];
  unit: number;
  localHours: string;
  canAddMe: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [withLogin, setWithLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const nextOrder = barbers.reduce((max, b) => Math.max(max, b.sortOrder + 1), 0);

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Barberos</h2>
        {!creating && (
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Nuevo
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Cada barbero tiene su agenda. Los dados de baja no reciben turnos nuevos ni entran al panel; los que tienen turnos
        no se pueden borrar.
      </p>

      {creating && (
        <div className="rounded-xl border border-brass/40 p-4">
          <BarberForm
            unit={unit}
            submitLabel="Agregar barbero"
            initial={{ name: "", sortOrder: String(nextOrder), ownHours: false, hours: weekRowsFrom(localHours) }}
            onCancel={() => setCreating(false)}
            extra={
              <div className="space-y-3">
                {canAddMe && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--color-brass)]" checked={isMe} onChange={(e) => setIsMe(e.target.checked)} />
                    Soy yo (también atiendo)
                  </label>
                )}
                {!isMe && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-brass)]"
                        checked={withLogin}
                        onChange={(e) => setWithLogin(e.target.checked)}
                      />
                      Crearle usuario para entrar al panel
                    </label>
                    {withLogin && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="new-barber-phone" className="label">Celular</label>
                          <input
                            id="new-barber-phone"
                            className="input"
                            type="tel"
                            inputMode="tel"
                            placeholder="11 2345 6789"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="new-barber-pass" className="label">Clave inicial</label>
                          <input
                            id="new-barber-pass"
                            className="input"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            }
            onSubmit={async (d) => {
              const err = await request("/api/panel/barberos", "POST", {
                ...payload(d),
                ...(isMe ? { isMe: true } : withLogin ? { login: { phone, password } } : {}),
              });
              if (!err) {
                setCreating(false);
                setPhone("");
                setPassword("");
                setIsMe(false);
                router.refresh();
              }
              return err;
            }}
          />
        </div>
      )}

      {barbers.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay barberos. Agregá al menos uno para recibir turnos.</p>
      ) : (
        <ul className="space-y-2">
          {barbers.map((b) => (
            <BarberItem key={b.id} barber={b} unit={unit} localHours={localHours} />
          ))}
        </ul>
      )}
    </section>
  );
}
