import { useState } from "react";
import { Link, useLocation } from "wouter";
import { KeyRound, Loader2 } from "lucide-react";
import { authClient } from "../../lib/auth";
import { useAdminText } from "../../queries/admin";
import { useLocale } from "../../hooks/use-locale";
import { Field, TextInput } from "../../components/ui/field";
import { ADMIN_EMAIL } from "../../../shared/admin-access";

/** Server + Better Auth errors arrive in English; show them in the panel's language. */
function localizeError(raw: string, a: ReturnType<typeof useAdminText>["a"]) {
  const text = raw.toLowerCase();
  if (text.includes("invite")) return a.login.badInvite;
  if (text.includes("invalid email") || (text.includes("email") && text.includes("valid")))
    return a.login.invalidEmail;
  if (text.includes("password") && (text.includes("short") || text.includes("8")))
    return a.login.shortPassword;
  if (text.includes("already") || text.includes("exists") || text.includes("taken"))
    return a.login.emailTaken;
  if (text.includes("invalid") || text.includes("credential") || text.includes("unauthorized"))
    return a.login.failed;
  return raw;
}

export default function AdminLogin() {
  const { a } = useAdminText();
  const { t } = useLocale();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({
        email: ADMIN_EMAIL,
        password: form.password,
      });
      if (result.error) throw new Error(result.error.message ?? a.login.failed);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? localizeError(err.message, a) : a.login.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone/50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3 no-underline">
          <img src="/images/site/logo.png" alt="" className="size-12" />
          <span className="font-display text-xl font-bold leading-snug">{t.brand}</span>
        </Link>

        <div className="comic-card bg-paper p-6">
          <h1 className="flex items-center gap-2 text-2xl">
            <KeyRound className="size-6" /> {a.login.title}
          </h1>
          <p className="mt-1 text-sm text-ink/60">{a.login.subtitle}</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label={a.login.email} required>
              <TextInput
                type="email"
                value={ADMIN_EMAIL}
                readOnly
                required
                autoComplete="username"
                className="min-w-0 w-full text-sm"
              />
            </Field>

            <Field label={a.login.password} required hint={a.login.passwordHint}>
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
              />
            </Field>

            <p className="text-sm text-ink/60">{a.login.recoveryUnavailable}</p>

            {error ? (
              <p className="rounded-xl border-2 border-ink bg-pink px-3 py-2 text-sm">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="comic-btn w-full bg-mint-deep px-5 py-2.5 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {a.login.working}
                </>
              ) : (
                a.login.submitSignIn
              )}
            </button>
          </form>
        </div>

        <Link
          to="/"
          className="mt-5 block text-center text-sm text-ink/60 no-underline hover:text-ink"
        >
          ← {a.common.back}
        </Link>
      </div>
    </div>
  );
}
