import { GraduationCap, Shield, Sparkles, User } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { type AuthState, authStore, type Role, roleHome, useAuth } from "@/features/auth/store";
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

  const quickDemoLogin = (r: Role) => {
    const mockUsers: Record<Role, { id: string; email: string; name: string }> = {
      mentor: { id: "u-mentor", email: "mentor1@example.com", name: "Priya Sharma" },
      candidate: { id: "u-candidate", email: "candidate01@example.com", name: "Arjun Mehta" },
      admin: { id: "u-admin", email: "admin@example.com", name: "System Admin" },
    };
    const targetUser = mockUsers[r];
    authStore.set({
      access_token: `mock-${r}-token`,
      refresh_token: `mock-${r}-refresh`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: r,
        is_active: true,
      },
    });
    navigate(safeNext ?? roleHome[r]);
  };

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

        {/* 1-Click Quick Demo Sign In */}
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4 space-y-2.5">
          <span className="text-xs font-semibold text-text">Quick Demo Access</span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => quickDemoLogin("mentor")}
              className="text-xs hover:border-primary-500 hover:text-primary-700"
            >
              <GraduationCap className="size-3.5 text-primary-600" />
              <span>Mentor</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => quickDemoLogin("candidate")}
              className="text-xs hover:border-primary-500 hover:text-primary-700"
            >
              <User className="size-3.5 text-info-700" />
              <span>Candidate</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => quickDemoLogin("admin")}
              className="text-xs hover:border-primary-500 hover:text-primary-700"
            >
              <Shield className="size-3.5 text-ai-700" />
              <span>Admin</span>
            </Button>
          </div>
          <div className="pt-1 text-center">
            <Link
              to="/design-showcase"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai-700 hover:underline"
            >
              <Sparkles className="size-3.5 text-ai-500" />
              <span>Or inspect all 12 UI Boards in Showcase</span>
            </Link>
          </div>
        </div>

        {/* Standard Credentials Form */}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="e.g. mentor1@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
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
          <Button type="submit" className="w-full bg-primary-600 text-white hover:bg-primary-700" disabled={busy || !email || !password}>
            {busy ? "Signing in…" : "Sign in with password"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
