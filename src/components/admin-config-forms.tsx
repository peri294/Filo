"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { ActionButton, request } from "@/components/admin-controls";
import { WeekHoursFields, weekRowsFrom, weekRowsPayload } from "@/components/week-hours";
import { formatPrice } from "@/lib/format";

export function FormMessage({ error, ok }: { error: string | null; ok?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-bad">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="text-sm text-ok">
        {ok}
      </p>
    );
  }
  return null;
}

export type SettingsValues = {
  name: string;
  address: string;
  whatsapp: string;
  weeklyHours: string;
  slotDurationMin: number;
  bookingWindowDays: number;
  minNoticeMin: number;
};

export function SettingsForm({ settings }: { settings: SettingsValues }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: settings.name,
    address: settings.address,
    whatsapp: settings.whatsapp,
    slotDurationMin: String(settings.slotDurationMin),
    bookingWindowDays: String(settings.bookingWindowDays),
    minNoticeMin: String(settings.minNoticeMin),
  });
  const [days, setDays] = useState(() => weekRowsFrom(settings.weeklyHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const err = await request("/api/panel/configuracion", "PUT", {
      ...form,
      weeklyHours: weekRowsPayload(days),
      slotDurationMin: Number(form.slotDurationMin),
      bookingWindowDays: Number(form.bookingWindowDays),
      minNoticeMin: Number(form.minNoticeMin),
    });
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setOk("Datos guardados");
      router.refresh();
    }
  }

  const unit = Number(form.slotDurationMin) || 1;

  return (
    <form onSubmit={submit} className="card space-y-5">
      <h2 className="font-semibold">Datos del local</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="label">
            Nombre
          </label>
          <input id="name" className="input" value={form.name} onChange={set("name")} maxLength={80} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="address" className="label">
            Dirección
          </label>
          <input
            id="address"
            className="input"
            value={form.address}
            onChange={set("address")}
            maxLength={160}
            placeholder="Av. Siempreviva 742, CABA"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="whatsapp" className="label">
            WhatsApp del local
          </label>
          <input
            id="whatsapp"
            className="input"
            type="tel"
            inputMode="tel"
            value={form.whatsapp}
            onChange={set("whatsapp")}
            placeholder="11 2345 6789"
            required
          />
          <p className="mt-1 text-xs text-muted">
            Recibe las confirmaciones de los turnos en efectivo. Con código de área.
          </p>
        </div>
      </div>

      <WeekHoursFields
        value={days}
        onChange={setDays}
        unit={unit}
        legend="Días y horarios de atención"
        idPrefix="local"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="slotDurationMin" className="label">
            Unidad de agenda (min)
          </label>
          <input
            id="slotDurationMin"
            type="number"
            inputMode="numeric"
            className="input"
            min={5}
            max={240}
            step={5}
            value={form.slotDurationMin}
            onChange={set("slotDurationMin")}
            required
          />
        </div>
        <div>
          <label htmlFor="bookingWindowDays" className="label">
            Reservas hasta (días)
          </label>
          <input
            id="bookingWindowDays"
            type="number"
            inputMode="numeric"
            className="input"
            min={1}
            max={365}
            value={form.bookingWindowDays}
            onChange={set("bookingWindowDays")}
            required
          />
        </div>
        <div>
          <label htmlFor="minNoticeMin" className="label">
            Anticipación mínima (min)
          </label>
          <input
            id="minNoticeMin"
            type="number"
            inputMode="numeric"
            className="input"
            min={0}
            max={10080}
            value={form.minNoticeMin}
            onChange={set("minNoticeMin")}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        La unidad de agenda es el bloque mínimo de la grilla: los horarios y la duración de los servicios tienen que ser
        múltiplos de ella (y ella, múltiplo de 5 minutos). Cambiarla no afecta a los turnos ya reservados.
      </p>

      <FormMessage error={error} ok={ok} />
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar datos
      </button>
    </form>
  );
}

export type ServiceValues = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  sortOrder: number;
  active: boolean;
  appointmentCount: number;
};

type ServiceDraft = { name: string; description: string; price: string; durationMin: string; sortOrder: string };

function ServiceForm({
  initial,
  unit,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ServiceDraft;
  unit: number;
  submitLabel: string;
  onSubmit: (draft: ServiceDraft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefix = useId();

  const set = (key: keyof ServiceDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

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
      <div>
        <label htmlFor={`${prefix}-name`} className="label">
          Nombre
        </label>
        <input
          id={`${prefix}-name`}
          className="input"
          value={draft.name}
          onChange={set("name")}
          maxLength={60}
          required
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-desc`} className="label">
          Descripción (opcional)
        </label>
        <textarea
          id={`${prefix}-desc`}
          className="input min-h-20"
          value={draft.description}
          onChange={set("description")}
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor={`${prefix}-price`} className="label">
            Precio ($)
          </label>
          <input
            id={`${prefix}-price`}
            type="number"
            inputMode="numeric"
            className="input"
            min={0}
            step={1}
            value={draft.price}
            onChange={set("price")}
            required
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-dur`} className="label">
            Duración (min)
          </label>
          <input
            id={`${prefix}-dur`}
            type="number"
            inputMode="numeric"
            className="input"
            min={unit}
            step={unit}
            value={draft.durationMin}
            onChange={set("durationMin")}
            required
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-order`} className="label">
            Orden
          </label>
          <input
            id={`${prefix}-order`}
            type="number"
            inputMode="numeric"
            className="input"
            min={0}
            step={1}
            value={draft.sortOrder}
            onChange={set("sortOrder")}
            required
          />
        </div>
      </div>
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function toPayload(d: ServiceDraft) {
  return {
    name: d.name,
    description: d.description,
    price: Number(d.price),
    durationMin: Number(d.durationMin),
    sortOrder: Number(d.sortOrder),
  };
}

function ServiceItem({ service, unit }: { service: ServiceValues; unit: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-xl bg-surface-2 p-4">
        <ServiceForm
          unit={unit}
          submitLabel="Guardar"
          initial={{
            name: service.name,
            description: service.description ?? "",
            price: String(service.price),
            durationMin: String(service.durationMin),
            sortOrder: String(service.sortOrder),
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (d) => {
            const err = await request(`/api/panel/servicios/${service.id}`, "PATCH", toPayload(d));
            if (!err) {
              setEditing(false);
              router.refresh();
            }
            return err;
          }}
        />
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-3 rounded-xl bg-surface-2 p-3 ${service.active ? "" : "opacity-70"}`}>
      <div className="text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {service.name}
          {!service.active && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Inactivo</span>
          )}
        </p>
        <p className="text-muted">
          {formatPrice(service.price)} ·{service.durationMin} min · orden {service.sortOrder}
        </p>
        {service.description && <p className="text-xs text-muted">{service.description}</p>}
        {service.durationMin % unit !== 0 && (
          <p className="text-xs text-warn">La duración no es múltiplo de la unidad de agenda ({unit} min).</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden /> Editar
        </button>
        <ActionButton
          url={`/api/panel/servicios/${service.id}`}
          method="PATCH"
          body={{ active: !service.active }}
          className={service.active ? "btn-ghost px-3 py-2 text-sm" : "btn-primary px-3 py-2 text-sm"}
          confirmText={service.active ? "¿Desactivar?" : undefined}
        >
          {service.active ? "Desactivar" : "Activar"}
        </ActionButton>
        {service.appointmentCount === 0 && (
          <ActionButton
            url={`/api/panel/servicios/${service.id}`}
            method="DELETE"
            className="btn-danger px-3 py-2 text-sm"
            confirmText="¿Borrar?"
          >
            Borrar
          </ActionButton>
        )}
      </div>
    </li>
  );
}

export function ServicesEditor({ services, unit }: { services: ServiceValues[]; unit: number }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const nextOrder = services.reduce((max, s) => Math.max(max, s.sortOrder + 1), 0);

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Servicios</h2>
        {!creating && (
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Nuevo
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Los servicios inactivos no se muestran al reservar. Los que ya tienen turnos no se pueden borrar: desactivalos.
      </p>

      {creating && (
        <div className="rounded-xl border border-brass/40 p-4">
          <ServiceForm
            unit={unit}
            submitLabel="Crear servicio"
            initial={{ name: "", description: "", price: "", durationMin: String(unit), sortOrder: String(nextOrder) }}
            onCancel={() => setCreating(false)}
            onSubmit={async (d) => {
              const err = await request("/api/panel/servicios", "POST", toPayload(d));
              if (!err) {
                setCreating(false);
                router.refresh();
              }
              return err;
            }}
          />
        </div>
      )}

      {services.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay servicios cargados.</p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <ServiceItem key={s.id} service={s} unit={unit} />
          ))}
        </ul>
      )}
    </section>
  );
}
