"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { request } from "@/components/admin-controls";
import { FormMessage } from "@/components/admin-config-forms";

const EMPTY = { name: "", slug: "", whatsapp: "", adminName: "", adminPhone: "", adminPassword: "" };

/** "Barbería Don Juan" → "barberia-don-juan" (sugerencia editable). */
function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateTenantForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(value) } : {}) }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const err = await request("/api/superadmin/barberias", "POST", form);
    setBusy(false);
    if (err) return setError(err);
    setOk(`Barbería creada: /${form.slug}. Pasale al admin su celular y clave.`);
    setForm(EMPTY);
    setSlugTouched(false);
    router.refresh();
  }

  const field = (key: keyof typeof EMPTY, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`t-${key}`} className="label">{label}</label>
      <input id={`t-${key}`} className="input" value={form[key]} onChange={set(key)} required {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Plus className="size-4 text-brass" aria-hidden /> Nueva barbería
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "Nombre de la barbería", { maxLength: 80 })}
        <div>
          <label htmlFor="t-slug" className="label">Dirección web</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted">/</span>
            <input
              id="t-slug"
              className="input"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
              }}
              pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
              required
            />
          </div>
          <p className="hint">Minúsculas, números y guiones.</p>
        </div>
        {field("whatsapp", "WhatsApp del local", { type: "tel", inputMode: "tel", placeholder: "11 2345 6789" })}
        {field("adminName", "Nombre del admin", { maxLength: 60 })}
        {field("adminPhone", "Celular del admin", { type: "tel", inputMode: "tel", placeholder: "11 2345 6789" })}
        {field("adminPassword", "Clave inicial del admin", { type: "password", autoComplete: "new-password", minLength: 8 })}
      </div>
      <FormMessage error={error} ok={ok} />
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Crear barbería
      </button>
    </form>
  );
}

/** Plan B: clave nueva para el admin que no puede recuperarla por SMS. */
export function ResetAdminPassword({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" aria-hidden /> Clave del admin
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const err = await request(`/api/superadmin/barberias/${tenantId}/clave`, "POST", { password });
        setBusy(false);
        if (err) return setError(err);
        setOk("Clave cambiada. Se cerraron sus sesiones.");
        setPassword("");
      }}
    >
      <div className="min-w-48 flex-1">
        <label htmlFor={`reset-${tenantId}`} className="label">Clave nueva del admin</label>
        <input
          id={`reset-${tenantId}`}
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn-primary px-4" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar
      </button>
      <button type="button" className="btn-ghost px-4" onClick={() => setOpen(false)}>
        Cerrar
      </button>
      <div className="w-full">
        <FormMessage error={error} ok={ok} />
      </div>
    </form>
  );
}
