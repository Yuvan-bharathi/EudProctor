import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock, Eye, EyeOff, KeyRound, ListChecks, Mail } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { type AuthState, authStore, useAuth } from "@/features/auth/store";
import { api, errorMessage } from "@/lib/api";

interface Invitation {
  status: "pending" | "accepted" | "expired";
  candidate_name: string;
  candidate_email: string;
  candidate_username: string | null;
  needs_password: boolean;
  exam_code: string | null;
  exam_title: string;
  course_name: string | null;
  duration_min: number;
  question_count: number;
  window_start: string | null;
  window_end: string | null;
  link_expires_at: string | null;
}

const PORTAL = "/candidate/assessments";

function fmt(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STEPS = ["Open invitation", "Sign in", "Candidate portal"];

/**
 * Landing page of the "Accept Invitation" email button (public — no sign-in needed).
 * First visit: the candidate creates a password, which accepts the invitation and signs them in.
 * Later visits: the candidate signs in with that password. Either way they land in the candidate portal,
 * where the assessment is started (camera setup → pre-checks → assessment).
 */
export function JoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api<Invitation>(`/invite/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () =>
      api<AuthState>(`/invite/${encodeURIComponent(token)}/accept`, { body: { password }, auth: false }),
    onSuccess: (res) => {
      authStore.set(res);
      navigate(PORTAL, { replace: true, state: { welcomeExam: invite.data?.exam_title } });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const inv = invite.data;
  const creating = !!inv?.needs_password;
  const rules = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Contains a letter and a number" },
    { ok: password.length > 0 && password === confirm, label: "Passwords match" },
  ];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (creating && !rules.every((r) => r.ok)) {
      setFormError("Please meet all the password requirements.");
      return;
    }
    accept.mutate();
  };

  // Automatically clear any conflicting session (e.g. mentor or different candidate)
  // so the invitee always sees their clean assessment sign-in.
  useEffect(() => {
    if (user && (user.role !== "candidate" || (inv && user.email.toLowerCase() !== inv.candidate_email.toLowerCase()))) {
      authStore.clear();
    }
  }, [user, inv]);

  const signedInAsInvitee =
    !!user && !!inv && user.role === "candidate" && user.email.toLowerCase() === inv.candidate_email.toLowerCase();
  const activeStep = !inv ? 0 : signedInAsInvitee && inv.status === "accepted" ? 2 : 1;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-lg space-y-5 p-6 sm:p-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">EduProctor · Assessment invitation</p>
          <h1 className="text-xl font-semibold text-text">
            {inv ? `Welcome, ${inv.candidate_name}` : "Opening your invitation"}
          </h1>
        </header>

        {/* Step indicator */}
        <ol className="flex items-center gap-2 text-[11px] font-medium" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1.5">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  i < activeStep
                    ? "bg-primary-600 text-white"
                    : i === activeStep
                      ? "border-2 border-primary-600 text-primary-700"
                      : "border border-border text-muted"
                }`}
                aria-current={i === activeStep ? "step" : undefined}
              >
                {i < activeStep ? "✓" : i + 1}
              </span>
              <span className={i === activeStep ? "text-text" : "text-muted"}>{s}</span>
            </li>
          ))}
        </ol>

        {invite.isPending && <LoadingState rows={3} label="Checking your invitation" />}

        {invite.isError && (
          <div className="space-y-3">
            <ErrorState message={errorMessage(invite.error)} />
            <Button variant="secondary" onClick={() => navigate("/login")}>
              Go to sign in
            </Button>
          </div>
        )}

        {inv && (
          <>
            {/* Assessment details */}
            <section className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text">{inv.exam_title}</p>
                {inv.exam_code && (
                  <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-muted">
                    ID {inv.exam_code}
                  </span>
                )}
              </div>
              {inv.course_name && <p className="text-xs text-muted">{inv.course_name}</p>}
              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 text-muted">
                  <Clock className="size-3.5" aria-hidden />
                  <dd>
                    {inv.duration_min} min · {inv.question_count} questions
                  </dd>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <CalendarClock className="size-3.5" aria-hidden />
                  <dd>Opens {fmt(inv.window_start)}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted sm:col-span-2">
                  <Mail className="size-3.5" aria-hidden />
                  <dd>
                    Invitation for <span className="font-medium text-text">{inv.candidate_email}</span>
                  </dd>
                </div>
              </dl>
            </section>

            {inv.status === "expired" && (
              <ErrorState message="This invitation has expired. Please ask your mentor to resend it." />
            )}

            {/* Already accepted and signed in → straight to the portal */}
            {inv.status === "accepted" && signedInAsInvitee && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-success-700">
                  <CheckCircle2 className="size-4" aria-hidden /> Invitation accepted.
                </p>
                <Button className="w-full" onClick={() => navigate(PORTAL, { replace: true })}>
                  Go to Candidate Portal
                </Button>
              </div>
            )}

            {/* Password form: create (first time) or sign in (already has a password) */}
            {inv.status !== "expired" &&
              !(inv.status === "accepted" && signedInAsInvitee) && (
                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                      <KeyRound className="size-4 text-primary-700" aria-hidden />
                      {creating ? "Create your password" : "Sign in with your invitation credentials"}
                    </h2>
                    <p className="text-xs text-muted">
                      {creating
                        ? "You'll use your email and this password to sign in to the EduProctor candidate portal."
                        : "Enter the password from your invitation email. If you changed it, use your new password."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inv-user">Username</Label>
                    <Input
                      id="inv-user"
                      value={inv.candidate_username ?? inv.candidate_email}
                      readOnly
                      autoComplete="username"
                    />
                    <p className="text-[11px] text-muted">You can also sign in with {inv.candidate_email}.</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="inv-pw">{creating ? "New password" : "Password"}</Label>
                      {!creating && (
                        <Link to="/forgot-password" className="text-xs font-medium text-primary-700 hover:underline">
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="inv-pw"
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setFormError(null);
                        }}
                        autoComplete={creating ? "new-password" : "current-password"}
                        autoFocus
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

                  {creating && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="inv-pw2">Confirm password</Label>
                        <Input
                          id="inv-pw2"
                          type={show ? "text" : "password"}
                          value={confirm}
                          onChange={(e) => {
                            setConfirm(e.target.value);
                            setFormError(null);
                          }}
                          autoComplete="new-password"
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
                    </>
                  )}

                  {formError && (
                    <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
                      {formError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={accept.isPending || !password}>
                    {accept.isPending
                      ? "Please wait..."
                      : creating
                        ? "Create password & open Candidate Portal"
                        : "Sign in & open Candidate Portal"}
                  </Button>
                </form>
              )}

            <div className="flex items-start gap-2 rounded-lg bg-primary-50 p-3 text-xs text-primary-700">
              <ListChecks className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Next: in the Candidate Portal open <strong>My Assessments</strong> and start{" "}
                <strong>{inv.exam_title}</strong> when it opens. You'll do a quick camera and identity check before the
                first question. Keep your webcam and microphone ready.
              </p>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
