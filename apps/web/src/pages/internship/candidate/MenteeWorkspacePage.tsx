import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Code2,
  FileQuestion,
  ListTodo,
  LogOut,
  MessageSquare,
  Rocket,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import {
  internshipApi,
  type AttendanceDay,
  type BlockerAnswer,
  type DayStatus,
  type InternTask,
  type InternTaskStatus,
} from "@/lib/internshipApi";

// ------------------------------------------------------------------ helpers

const DAY_TONE: Record<DayStatus, BadgeProps["tone"]> = {
  Present: "success",
  "Half Day": "warning",
  Short: "danger",
  Leave: "info",
  Absent: "neutral",
  "In Progress": "primary",
  "Needs Correction": "warning",
};

const TASK_TONE: Record<InternTaskStatus, BadgeProps["tone"]> = {
  Assigned: "neutral",
  "In Progress": "info",
  Review: "warning",
  Rework: "danger",
  Done: "success",
};

function fmtTime(iso: string, timeZone?: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Current time, ticking every second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

// ------------------------------------------------------------------ page

export function MenteeWorkspacePage() {
  usePageTitle("Mentee Workspace");

  const me = useQuery({ queryKey: ["internship", "me"], queryFn: internshipApi.me });
  const enrolled = me.data?.enrolled === true;

  const tasks = useQuery({
    queryKey: ["internship", "tasks"],
    queryFn: () => internshipApi.tasks(),
    enabled: enrolled,
  });

  if (me.isPending) return <LoadingState rows={6} label="Loading your workspace" />;
  if (me.isError) return <ErrorState message={errorMessage(me.error)} onRetry={() => me.refetch()} />;

  if (!enrolled) {
    return (
      <EmptyState message="You're not enrolled in an internship yet. Once your programme admin adds you to a cohort, your workspace, tasks and attendance will appear here." />
    );
  }

  const m = me.data;
  const firstName = (m.name ?? "").split(" ")[0];
  const fullDay = m.rules?.full_day_hours;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Badge tone="primary">
              <Rocket className="size-3" aria-hidden="true" />
              <span>
                {m.cohort_name} · Track: {m.track}
              </span>
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
              Welcome back{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              You are in <strong className="text-primary-700">Month {m.current_month}, Week {m.current_week}</strong> of
              your internship. Punch in when you start, post your standup and ask the Co-Pilot when you're stuck.
            </p>
          </div>
          <Button asChild>
            <Link to="/candidate/internship/coding">
              <Code2 aria-hidden="true" />
              <span>Open Coding Platform</span>
            </Link>
          </Button>
        </div>

        <PunchWidget fullDayHours={fullDay} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Attendance rate (this month)"
          value={m.attendance_rate_pct == null ? "—" : `${m.attendance_rate_pct}%`}
          hint={m.attendance_rate_pct == null ? "Not enough working days yet" : "From your punch-in records"}
        />
        <Stat
          label="Tasks completed"
          value={m.tasks_total == null ? "—" : `${m.tasks_done ?? 0} / ${m.tasks_total}`}
          hint="Approved by your mentor"
        />
        <Stat label="Waiting for review" value={String(m.tasks_in_review ?? 0)} hint="Submitted tasks" />
        <Stat
          label="Weekly quizzes to take"
          value={String(m.pending_quizzes ?? 0)}
          hint={(m.pending_quizzes ?? 0) > 0 ? "Released by your mentor" : "You're all caught up"}
        />
      </div>

      {/* Weekly quiz banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <FileQuestion className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Weekly knowledge check</p>
            <p className="text-xs text-muted">
              {(m.pending_quizzes ?? 0) > 0
                ? `You have ${m.pending_quizzes} weekly quiz${m.pending_quizzes === 1 ? "" : "zes"} ready to take.`
                : "No weekly quiz is waiting for you right now."}
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/candidate/internship/mcq">Go to Weekly MCQs →</Link>
        </Button>
      </div>

      {/* Standup + Co-Pilot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StandupCard tasks={tasks.data ?? []} />
        <BlockerCopilotCard tasks={tasks.data ?? []} />
      </div>

      {/* Tasks + mentor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">My current tasks</h2>
              <p className="text-xs text-muted">Assigned by {m.mentor_name ?? "your mentor"}</p>
            </div>
            <Link to="/candidate/internship/tasks" className="text-xs font-semibold text-primary-700 hover:underline">
              View all tasks →
            </Link>
          </div>
          <CurrentTasks query={tasks} />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-text">My mentor</h2>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                <UserRound className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">{m.mentor_name ?? "—"}</h3>
                <p className="text-xs text-muted">
                  {m.track} · started {m.started_on}
                </p>
              </div>
            </div>
            <nav aria-label="Internship pages" className="mt-4 grid gap-2 border-t border-border pt-3">
              <QuickLink to="/candidate/internship/attendance" icon={<CalendarCheck2 />} label="Attendance & leave" />
              <QuickLink to="/candidate/internship/tasks" icon={<ListTodo />} label="My tasks" />
              <QuickLink to="/candidate/internship/mcq" icon={<FileQuestion />} label="Weekly MCQs" />
              <QuickLink to="/candidate/internship/coding" icon={<Code2 />} label="Coding platform" />
              <QuickLink to="/candidate/internship/skills" icon={<TrendingUp />} label="My skill matrix" />
              <QuickLink to="/candidate/internship/reviews" icon={<Award />} label="Monthly reviews" />
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sections

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
      <span className="text-[11px] text-muted">{hint}</span>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text hover:bg-surface-muted [&_svg]:size-3.5 [&_svg]:text-muted"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function PunchWidget({ fullDayHours }: { fullDayHours?: number }) {
  const qc = useQueryClient();
  const att = useQuery({
    queryKey: ["internship", "attendance", "current"],
    queryFn: () => internshipApi.myAttendance(),
    refetchInterval: 60_000,
  });
  const today: AttendanceDay | undefined = att.data?.today;
  const openSession = today?.sessions.find((s) => !s.punch_out_at);
  const now = useNow(!!openSession);
  const tz = att.data?.rules.timezone;
  const full = att.data?.rules.full_day_hours ?? fullDayHours;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["internship", "attendance"] });
    qc.invalidateQueries({ queryKey: ["internship", "me"] });
  };
  const punchIn = useMutation({ mutationFn: () => internshipApi.punchIn(), onSuccess: invalidate });
  const punchOut = useMutation({ mutationFn: () => internshipApi.punchOut(), onSuccess: invalidate });
  const actionError = punchIn.error ?? punchOut.error;

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
      {att.isPending ? (
        <LoadingState rows={1} label="Loading today's attendance" />
      ) : att.isError ? (
        <ErrorState message={errorMessage(att.error)} onRetry={() => att.refetch()} />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2.5 text-primary-700">
              <CalendarCheck2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text">Today's attendance</h3>
                {today && <Badge tone={DAY_TONE[today.status]}>{today.status}</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {openSession ? (
                  <>
                    Punched in at {fmtTime(openSession.punch_in_at, tz)} · current session{" "}
                    <span className="font-mono font-semibold text-text" aria-live="off">
                      {fmtElapsed(now - new Date(openSession.punch_in_at).getTime())}
                    </span>
                  </>
                ) : today && today.sessions.length > 0 ? (
                  "Punched out. Punch in again if you resume work today."
                ) : (
                  "You haven't punched in yet today."
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Logged today: <strong className="text-text">{today?.total_hours ?? 0} h</strong>
                {full != null && <> of {full} h for a full day</>}
                {openSession && " (updates every minute)"}
              </p>
              {today?.status === "Needs Correction" && (
                <p className="mt-1 text-xs text-warning-800">
                  A punch-out was missed. Your mentor will confirm the correct time.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {openSession ? (
              <Button variant="secondary" onClick={() => punchOut.mutate()} disabled={punchOut.isPending}>
                <LogOut aria-hidden="true" />
                <span>{punchOut.isPending ? "Punching out…" : "Punch Out"}</span>
              </Button>
            ) : (
              <Button onClick={() => punchIn.mutate()} disabled={punchIn.isPending}>
                <Clock aria-hidden="true" />
                <span>{punchIn.isPending ? "Punching in…" : "Punch In"}</span>
              </Button>
            )}
          </div>
        </div>
      )}
      {actionError && (
        <div className="mt-3">
          <ErrorState message={errorMessage(actionError)} />
        </div>
      )}
    </div>
  );
}

function StandupCard({ tasks }: { tasks: InternTask[] }) {
  const qc = useQueryClient();
  const standup = useQuery({ queryKey: ["internship", "standup", "today"], queryFn: internshipApi.standupToday });
  const [skipped, setSkipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ yesterday: string; today: string; blockers: string; task_id: string } | null>(null);

  // Prefill once data arrives (from an existing entry, or the server's suggestion).
  useEffect(() => {
    if (!standup.data || form) return;
    const { entry, suggested } = standup.data;
    setForm(
      entry
        ? { yesterday: entry.yesterday, today: entry.today, blockers: entry.blockers, task_id: entry.task_id ?? "" }
        : { yesterday: suggested.yesterday, today: "", blockers: "", task_id: suggested.task_id ?? "" },
    );
  }, [standup.data, form]);

  const submit = useMutation({
    mutationFn: (f: { yesterday: string; today: string; blockers: string; task_id: string }) =>
      internshipApi.submitStandup({ ...f, task_id: f.task_id || null }),
    onSuccess: (res) => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["internship", "standup"] });
      if (res.copilot) qc.invalidateQueries({ queryKey: ["internship", "blocker"] });
      qc.invalidateQueries({ queryKey: ["internship", "tasks"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form) submit.mutate(form);
  };

  const entry = standup.data?.entry;
  const openTasks = tasks.filter((t) => t.status !== "Done");

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm" aria-labelledby="standup-h">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="standup-h" className="flex items-center gap-2 text-sm font-semibold text-text">
          <MessageSquare className="size-4 text-muted" aria-hidden="true" />
          Daily standup
        </h2>
        {entry && !editing && (
          <Badge tone="success">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            Posted today
          </Badge>
        )}
      </div>

      {standup.isPending ? (
        <LoadingState rows={3} label="Loading standup" />
      ) : standup.isError ? (
        <ErrorState message={errorMessage(standup.error)} onRetry={() => standup.refetch()} />
      ) : skipped && !entry ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted p-3 text-xs text-muted">
          <span>Standup skipped for now.</span>
          <Button variant="ghost" size="sm" onClick={() => setSkipped(false)}>
            Write it now
          </Button>
        </div>
      ) : entry && !editing ? (
        <dl className="space-y-2 text-xs">
          <StandupLine label="Yesterday" value={entry.yesterday} />
          <StandupLine label="Today" value={entry.today} />
          <StandupLine label="Blockers" value={entry.blockers || "None"} />
          {entry.task_title && <StandupLine label="Task" value={entry.task_title} />}
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit today's standup
          </Button>
        </dl>
      ) : form ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="su-y">What did you do yesterday?</Label>
            <Textarea
              id="su-y"
              rows={2}
              className="min-h-0"
              value={form.yesterday}
              onChange={(e) => setForm({ ...form, yesterday: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="su-t">What will you do today?</Label>
            <Textarea
              id="su-t"
              rows={2}
              className="min-h-0"
              required
              value={form.today}
              onChange={(e) => setForm({ ...form, today: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="su-b">Anything blocking you? (the Co-Pilot will try to help)</Label>
            <Textarea
              id="su-b"
              rows={2}
              className="min-h-0"
              value={form.blockers}
              onChange={(e) => setForm({ ...form, blockers: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="su-task">Main task today</Label>
            <Select
              id="su-task"
              className="w-full"
              value={form.task_id}
              onChange={(e) => setForm({ ...form, task_id: e.target.value })}
            >
              <option value="">No specific task</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </div>
          {submit.isError && <ErrorState message={errorMessage(submit.error)} />}
          <div className="flex items-center justify-end gap-2">
            {entry ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSkipped(true)}>
                Skip for now
              </Button>
            )}
            <Button type="submit" size="sm" disabled={submit.isPending}>
              {submit.isPending ? "Posting…" : "Post standup"}
            </Button>
          </div>
        </form>
      ) : null}

      {submit.data?.copilot && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">The Co-Pilot looked at your blocker:</p>
          <CopilotAnswer answer={submit.data.copilot} />
        </div>
      )}
    </section>
  );
}

function StandupLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-text">{value || "—"}</dd>
    </div>
  );
}

function CopilotAnswer({ answer }: { answer: BlockerAnswer }) {
  return (
    <div className="rounded-xl border border-ai-100 bg-ai-50 p-4 text-xs">
      <Badge tone="ai">
        <Sparkles className="size-3" aria-hidden="true" />
        Blocker Co-Pilot
      </Badge>
      <p className="mt-2 whitespace-pre-wrap text-text">{answer.answer}</p>
      {answer.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-muted">Sources:</span>
          {answer.citations.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted"
            >
              <BookOpen className="size-3" aria-hidden="true" />
              {c.title}
            </span>
          ))}
        </div>
      )}
      {answer.escalated && (
        <div role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 p-2.5 text-warning-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            The Co-Pilot couldn't fully resolve this from the docs, so <strong>your mentor has been alerted</strong> and
            will follow up with you.
          </span>
        </div>
      )}
    </div>
  );
}

function BlockerCopilotCard({ tasks }: { tasks: InternTask[] }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [taskId, setTaskId] = useState("");
  const history = useQuery({ queryKey: ["internship", "blocker", "history"], queryFn: () => internshipApi.blockerHistory() });
  const ask = useMutation({
    mutationFn: () => internshipApi.askBlocker(question.trim(), taskId || null),
    onSuccess: () => {
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["internship", "blocker"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length >= 3) ask.mutate();
  };

  const openTasks = tasks.filter((t) => t.status !== "Done");
  const recent = (history.data ?? []).filter((h) => h.id !== ask.data?.id).slice(0, 5);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm" aria-labelledby="copilot-h">
      <h2 id="copilot-h" className="mb-1 flex items-center gap-2 text-sm font-semibold text-text">
        <Sparkles className="size-4 text-ai-500" aria-hidden="true" />
        Blocker Co-Pilot
      </h2>
      <p className="mb-3 text-xs text-muted">
        Stuck? Ask here first. Answers come from your cohort's docs; if it can't help, your mentor is alerted.
      </p>

      <form onSubmit={onSubmit} className="space-y-2">
        <Label htmlFor="cp-q" className="sr-only">
          Your question
        </Label>
        <Textarea
          id="cp-q"
          rows={3}
          className="min-h-0"
          placeholder="e.g. My API call returns 401 after login — what am I missing?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="cp-task" className="sr-only">
            Related task
          </Label>
          <Select id="cp-task" className="flex-1" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Not about a specific task</option>
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" disabled={ask.isPending || question.trim().length < 3}>
            <Send aria-hidden="true" />
            {ask.isPending ? "Asking…" : "Ask"}
          </Button>
        </div>
      </form>

      {ask.isError && (
        <div className="mt-3">
          <ErrorState message={errorMessage(ask.error)} />
        </div>
      )}
      {ask.data && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-text">You asked: {ask.data.question}</p>
          <CopilotAnswer answer={ask.data} />
        </div>
      )}

      <div className="mt-5 border-t border-border pt-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Recent questions</h3>
        {history.isPending ? (
          <LoadingState rows={2} label="Loading Co-Pilot history" />
        ) : history.isError ? (
          <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : recent.length === 0 ? (
          <p className="text-xs text-muted">No earlier questions yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((h) => (
              <li key={h.id}>
                <details className="rounded-lg border border-border p-2.5 text-xs">
                  <summary className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="truncate font-medium text-text">{h.question}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {h.escalated && <Badge tone="warning">Mentor alerted</Badge>}
                      <span className="text-muted">{new Date(h.created_at).toLocaleDateString()}</span>
                    </span>
                  </summary>
                  <div className="mt-2">
                    <CopilotAnswer answer={h} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CurrentTasks({
  query,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: InternTask[] | undefined; refetch: () => unknown };
}) {
  if (query.isPending) return <LoadingState rows={3} label="Loading tasks" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const current = (query.data ?? []).filter((t) => t.status !== "Done");
  if (current.length === 0) return <EmptyState message="No open tasks right now. Your mentor will assign the next one." />;
  return (
    <div className="space-y-3">
      {current.slice(0, 4).map((task) => (
        <div key={task.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  Month {task.month_number} · Week {task.week_number}
                </Badge>
                <h3 className="text-xs font-semibold text-text">{task.title}</h3>
                <Badge tone={TASK_TONE[task.status]}>{task.status}</Badge>
                {task.flagged_blocked_at && <Badge tone="warning">Flagged blocked</Badge>}
              </div>
              {task.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{task.description}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                {task.skill_area && (
                  <span>
                    Area: <strong className="text-text">{task.skill_area}</strong>
                  </span>
                )}
                <span>
                  Due: <strong className="text-text">{task.due_date ?? "—"}</strong>
                </span>
                <span>
                  Priority: <strong className="text-text">{task.priority}</strong>
                </span>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link to="/candidate/internship/tasks">View / Submit →</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
