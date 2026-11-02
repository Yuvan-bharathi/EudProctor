import { CheckCircle2, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-md space-y-6 p-6 shadow-sm sm:p-8">
        <header className="flex items-start gap-3 border-b border-border pb-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <KeyRound className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text">{title}</h1>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </header>
        {children}
        <p className="text-center text-xs text-muted">
          <Link to="/login" className="font-medium text-primary-700 underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}

/** Step 1 (all roles): ask for a reset link by username or email. */
export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ detail: string }>("/auth/forgot-password", { body: { identifier }, auth: false });
      setSent(res.detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Forgot password" subtitle="We'll email you a link to set a new password.">
      {sent ? (
        <div role="status" className="flex items-start gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{sent}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fp-id">Username or email</Label>
            <Input
              id="fp-id"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              autoFocus
              placeholder="e.g. tanu.shree or you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full" disabled={busy || !identifier.trim()}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

/** Step 2: the emailed link lands here (?token=...) to choose the new password. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const rules = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Contains a letter and a number" },
    { ok: password.length > 0 && password === confirm, label: "Passwords match" },
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rules.every((r) => r.ok)) {
      setError("Please meet all the password requirements.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ detail: string }>("/auth/reset-password", {
        body: { token, new_password: password },
        auth: false,
      });
      setDone(res.detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Shell title="Reset password" subtitle="This page needs the link from your reset email.">
        <ErrorState message="The reset link is missing or incomplete. Please request a new one." />
        <Link to="/forgot-password" className="block text-center text-sm font-medium text-primary-700 hover:underline">
          Request a new reset link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password" subtitle="Choose a password you haven't used here before.">
      {done ? (
        <div className="space-y-4">
          <div role="status" className="flex items-start gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{done}</p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="rp-pw">New password</Label>
            <div className="relative">
              <Input
                id="rp-pw"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-pw2">Confirm new password</Label>
            <Input
              id="rp-pw2"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <ul className="space-y-1 text-xs" aria-label="Password requirements">
            {rules.map((r) => (
              <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-success-700" : "text-muted"}`}>
                <CheckCircle2 className={`size-3.5 ${r.ok ? "" : "opacity-40"}`} aria-hidden />
                {r.label}
              </li>
            ))}
          </ul>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            {busy ? "Saving…" : "Save new password"}
          </Button>
        </form>
      )}
    </Shell>
  );
}
