import { GraduationCap } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { type AuthState, authStore, roleHome, useAuth } from "@/features/auth/store";
import { api, errorMessage } from "@/lib/api";

export function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
  if (user) return <Navigate to={safeNext ?? roleHome[user.role]} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthState>("/auth/login", { body: { email, password }, auth: false });
      authStore.set(res);
      navigate(safeNext ?? roleHome[res.user.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">EduProctor</h1>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Intelligence</p>
            </div>
          </div>
          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted">
            Soft Mist
          </span>
        </div>

        {/* Standard Credentials Form */}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Username or email</Label>
            <Input
              id="email"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="e.g. tanu.shree or mentor1@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary-700 underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button
            type="submit"
            className="w-full bg-primary-600 text-white hover:bg-primary-700 font-semibold"
            disabled={busy || !email || !password}
          >
            {busy ? "Signing in…" : "Sign in with password"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
