"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogIn, MessageSquareText, UserPlus } from "lucide-react";

async function post(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))).error as string) ?? "Ocurrió un error";
  } catch {
    return "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";
  }
}

function FormError({ error }: { error: string | null }) {
  return (
    <div aria-live="assertive">
      {error && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>}
    </div>
  );
}

function PhoneField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label htmlFor="phone" className="label">
        Celular
      </label>
      <input
        id="phone"
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="11 2345 6789"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
      <p className="hint">Con código de área, sin 0 ni 15.</p>
    </div>
  );
}

function PasswordField({
  id = "password",
  label = "Contraseña",
  value,
  onChange,
  isNew = false,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  isNew?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="password"
        autoComplete={isNew ? "new-password" : "current-password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={isNew ? 8 : undefined}
        required
      />
      {isNew && <p className="hint">Mínimo 8 caracteres.</p>}
    </div>
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="code" className="label">
        Código que te llegó por SMS
      </label>
      <input
        id="code"
        className="input tracking-[0.4em] tabular-nums"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        required
      />
    </div>
  );
}

/** Ingreso con celular y contraseña. Lo usan los clientes y el personal (cambia el endpoint). */
export function LoginForm({
  endpoint,
  redirectTo,
  recoverHref,
  registerHref,
}: {
  endpoint: string;
  redirectTo: string;
  recoverHref: string;
  registerHref?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await post(endpoint, { phone, password });
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <PhoneField value={phone} onChange={setPhone} />
      <PasswordField value={password} onChange={setPassword} />
      <FormError error={error} />
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
        Ingresar
      </button>
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href={recoverHref} className="text-muted underline underline-offset-2 hover:text-ink">
          Olvidé mi contraseña
        </Link>
        {registerHref && (
          <p className="text-muted">
            ¿No tenés cuenta?{" "}
            <Link href={registerHref} className="text-ink underline underline-offset-2">
              Creala acá
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}

/** Paso 1 de registro y recuperación: pedir el código por SMS. */
function useCodeRequest(codeEndpoint: string, purpose: "SIGNUP" | "RESET") {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(phone: string) {
    setBusy(true);
    setError(null);
    const err = await post(codeEndpoint, { phone, purpose });
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  }
  return { sent, busy, error, setError, send, reset: () => setSent(false) };
}

/** Registro de clientes: celular → código por SMS → nombre, contraseña y términos. */
export function RegisterForm({ redirectTo, loginHref }: { redirectTo: string; loginHref: string }) {
  const router = useRouter();
  const code = useCodeRequest("/api/cuenta/codigo", "SIGNUP");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.sent) return code.send(phone);
    setBusy(true);
    setError(null);
    const err = await post("/api/cuenta/registro", { phone, code: otp, name, password, acceptTerms: terms });
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <PhoneField value={phone} onChange={setPhone} disabled={code.sent} />
      {!code.sent ? (
        <>
          <FormError error={code.error} />
          <button type="submit" className="btn-primary w-full" disabled={code.busy}>
            {code.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquareText className="size-4" aria-hidden />}
            Enviarme el código
          </button>
        </>
      ) : (
        <>
          <p role="status" className="text-sm text-muted">
            Si el número es correcto, te llega un SMS con un código de 6 números.{" "}
            <button type="button" className="text-ink underline underline-offset-2" onClick={code.reset}>
              Cambiar número
            </button>
          </p>
          <CodeField value={otp} onChange={setOtp} />
          <div>
            <label htmlFor="name" className="label">
              Nombre y apellido
            </label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={60}
              required
            />
          </div>
          <PasswordField value={password} onChange={setPassword} isNew />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-brass)]"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              required
            />
            <span>
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="underline underline-offset-2">
                términos
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" target="_blank" className="underline underline-offset-2">
                política de privacidad
              </Link>
              . Mis datos y turnos los ven las barberías donde reservo.
            </span>
          </label>
          <FormError error={error} />
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            Crear cuenta
          </button>
        </>
      )}
      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={loginHref} className="text-ink underline underline-offset-2">
          Ingresá
        </Link>
      </p>
    </form>
  );
}

/** Recuperar la contraseña con un código por SMS. Para clientes y para el personal. */
export function RecoverForm({
  codeEndpoint,
  resetEndpoint,
  redirectTo,
}: {
  codeEndpoint: string;
  resetEndpoint: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const code = useCodeRequest(codeEndpoint, "RESET");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.sent) return code.send(phone);
    setBusy(true);
    setError(null);
    const err = await post(resetEndpoint, { phone, code: otp, password });
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <PhoneField value={phone} onChange={setPhone} disabled={code.sent} />
      {!code.sent ? (
        <>
          <FormError error={code.error} />
          <button type="submit" className="btn-primary w-full" disabled={code.busy}>
            {code.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquareText className="size-4" aria-hidden />}
            Enviarme el código
          </button>
        </>
      ) : (
        <>
          <p role="status" className="text-sm text-muted">
            Si hay una cuenta con ese número, te llega un SMS con un código de 6 números.{" "}
            <button type="button" className="text-ink underline underline-offset-2" onClick={code.reset}>
              Cambiar número
            </button>
          </p>
          <CodeField value={otp} onChange={setOtp} />
          <PasswordField id="new-password" label="Contraseña nueva" value={password} onChange={setPassword} isNew />
          <FormError error={error} />
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
            Cambiar contraseña
          </button>
        </>
      )}
    </form>
  );
}

/** Botón de salir para cualquier tipo de sesión. */
export function LogoutButton({ endpoint, redirectTo, className }: { endpoint: string; redirectTo: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className ?? "btn-ghost px-3 py-2 text-sm"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await post(endpoint, {});
        router.replace(redirectTo);
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
