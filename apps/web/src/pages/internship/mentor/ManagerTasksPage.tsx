import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCode,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import {
  type CodeFinding,
  type InternTask,
  type InternTaskStatus,
  type Mentee,
  type Submission,
  type WeeklyQuiz,
  internshipApi,
  reviewStatusLabel,
} from "@/lib/internshipApi";
import { cn } from "@/lib/utils";

const INBOX = "/mentor/internship/coding";

const COLUMNS: { status: InternTaskStatus; label: string; tone: BadgeProps["tone"] }[] = [
  { status: "Assigned", label: "Assigned", tone: "neutral" },
  { status: "In Progress", label: "In progress", tone: "primary" },
  { status: "Review", label: "Pending review", tone: "warning" },
  { status: "Rework", label: "Rework required", tone: "danger" },
  { status: "Done", label: "Done", tone: "success" },
];
const STATUS_TONE = Object.fromEntries(COLUMNS.map((c) => [c.status, c.tone])) as Record<InternTaskStatus, BadgeProps["tone"]>;
const PRIORITY_TONE = { High: "danger", Medium: "warning", Low: "neutral" } as const;
const SEVERITY_TONE = { high: "danger", medium: "warning", low: "info" } as const;
const SEVERITY_ROW = { high: "bg-danger-50", medium: "bg-warning-50", low: "bg-info-50" } as const;

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function invalidateTaskData(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ["tasks", "submissions", "overview", "mentees"]) qc.invalidateQueries({ queryKey: ["internship", key] });
}

// ------------------------------------------------------------------ page

export function ManagerTasksPage() {
  usePageTitle("Tasks");
  const [menteeFilter, setMenteeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<InternTaskStatus | "">("");
  const [formFor, setFormFor] = useState<InternTask | "new" | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const mentees = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });
  const tasks = useQuery({
    queryKey: ["internship", "tasks", menteeFilter || "all", statusFilter || "all"],
    queryFn: () => internshipApi.tasks({ mentee_id: menteeFilter || undefined, status: statusFilter || undefined }),
  });

  const openTask = tasks.data?.find((t) => t.id === openTaskId) ?? null;
  const columns = statusFilter ? COLUMNS.filter((c) => c.status === statusFilter) : COLUMNS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <ListTodo aria-hidden="true" /> Internship tasks
          </Badge>
          <h1 className="mt-1 text-xl font-semibold text-text sm:text-2xl">Tasks</h1>
          <p className="text-sm text-muted">Assign tasks to your interns, review submissions and give feedback.</p>
        </div>
        <Button onClick={() => setFormFor("new")} disabled={!mentees.data?.length}>
          <Plus /> New task
        </Button>
      </div>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div>
          <Label htmlFor="f-mentee">Intern</Label>
          <Select id="f-mentee" value={menteeFilter} onChange={(e) => setMenteeFilter(e.target.value)}>
            <option value="">All interns</option>
            {mentees.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-status">Status</Label>
          <Select
            id="f-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InternTaskStatus | "")}
          >
            <option value="">All statuses</option>
            {COLUMNS.map((c) => (
              <option key={c.status} value={c.status}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        {mentees.isError && <ErrorState message={errorMessage(mentees.error)} onRetry={() => mentees.refetch()} />}
      </Card>

      {tasks.isPending ? (
        <LoadingState rows={4} />
      ) : tasks.isError ? (
        <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
      ) : tasks.data.length === 0 ? (
        <EmptyState
          message={menteeFilter || statusFilter ? "No tasks match these filters." : "No tasks yet."}
          action={
            mentees.data?.length ? (
              <Button variant="secondary" size="sm" onClick={() => setFormFor("new")}>
                <Plus /> New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("grid grid-cols-1 gap-4", columns.length > 1 && "md:grid-cols-3 xl:grid-cols-5")}>
          {columns.map((col) => {
            const items = tasks.data.filter((t) => t.status === col.status);
            return (
              <section key={col.status} className="space-y-2 rounded-xl bg-surface-muted p-3" aria-label={col.label}>
                <div className="flex items-center justify-between">
                  <Badge tone={col.tone}>{col.label}</Badge>
                  <span className="text-xs text-muted">{items.length}</span>
                </div>
                {items.length === 0 && <p className="py-4 text-center text-xs text-subtle">No tasks</p>}
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenTaskId(t.id)}
                    className="w-full rounded-lg border border-border bg-surface p-3 text-left hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-text">{t.title}</p>
                      <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t.mentee_name} · Week {t.week_number}
                    </p>
                    {t.due_date && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Calendar className="size-3" aria-hidden="true" /> Due {t.due_date}
                      </p>
                    )}
                    {t.flagged_blocked_at && (
                      <Badge tone="warning" className="mt-2">
                        Flagged blocked
                      </Badge>
                    )}
                    {t.latest_submission && (
                      <p className="mt-2 text-xs text-subtle">{reviewStatusLabel(t.latest_submission.review_status)}</p>
                    )}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <QuizGenerator mentees={mentees} />

      {formFor && mentees.data && (
        <TaskFormModal
          mentees={mentees.data}
          task={formFor === "new" ? null : formFor}
          defaultMenteeId={menteeFilter}
          onClose={() => setFormFor(null)}
        />
      )}
      {openTask && !formFor && (
        <TaskDetailModal
          key={openTask.id}
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onEdit={() => setFormFor(openTask)}
          onDeleted={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ modal shell

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-text/30 p-4 sm:p-8"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("w-full rounded-xl border border-border bg-surface p-5 shadow-sm", wide ? "max-w-3xl" : "max-w-xl")}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ create / edit

function TaskFormModal({
  mentees,
  task,
  defaultMenteeId,
  onClose,
}: {
  mentees: Mentee[];
  task: InternTask | null;
  defaultMenteeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [menteeId, setMenteeId] = useState(task?.mentee_id ?? (defaultMenteeId || mentees[0]?.id || ""));
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [criteria, setCriteria] = useState(task?.acceptance_criteria ?? "");
  const [skillArea, setSkillArea] = useState(task?.skill_area ?? "");
  const [tags, setTags] = useState(task?.skill_tags.join(", ") ?? "");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [week, setWeek] = useState(task ? String(task.week_number) : "");
  const [localError, setLocalError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      acceptance_criteria: string;
      skill_area: string;
      skill_tags: string[];
      priority: "High" | "Medium" | "Low";
      due_date: string | null;
      week_number?: number;
    }) => (task ? internshipApi.patchTask(task.id, body) : internshipApi.createTask({ ...body, mentee_id: menteeId })),
    onSuccess: () => {
      invalidateTaskData(qc);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const skillTags = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (skillTags.length > 8) return setLocalError("Use at most 8 skill tags.");
    const weekNum = week.trim() === "" ? undefined : Number(week);
    if (weekNum !== undefined && (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 12))
      return setLocalError("Week must be a whole number from 1 to 12.");
    if (task && weekNum === undefined) return setLocalError("Enter the week number (1 to 12).");
    if (!task && !menteeId) return setLocalError("Choose an intern.");
    save.mutate({
      title: title.trim(),
      description,
      acceptance_criteria: criteria,
      skill_area: skillArea.trim() || "General",
      skill_tags: skillTags,
      priority,
      due_date: dueDate || null,
      week_number: weekNum,
    });
  };

  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="t-mentee">Intern</Label>
          {task ? (
            <p id="t-mentee" className="text-sm text-text">
              {task.mentee_name}
            </p>
          ) : (
            <Select id="t-mentee" className="w-full" value={menteeId} onChange={(e) => setMenteeId(e.target.value)} required>
              {mentees.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.track} (week {m.current_week})
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>
        <div>
          <Label htmlFor="t-desc">Description</Label>
          <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="t-crit">Acceptance criteria</Label>
          <Textarea id="t-crit" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="t-area">Skill area</Label>
            <Input
              id="t-area"
              value={skillArea}
              onChange={(e) => setSkillArea(e.target.value)}
              maxLength={80}
              placeholder="General"
            />
          </div>
          <div>
            <Label htmlFor="t-tags">Skill tags (comma-separated, max 8)</Label>
            <Input id="t-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, testing" />
          </div>
          <div>
            <Label htmlFor="t-prio">Priority</Label>
            <Select
              id="t-prio"
              className="w-full"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "High" | "Medium" | "Low")}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="t-due">Due date</Label>
            <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="t-week">Week number{task ? "" : " (blank = intern’s current week)"}</Label>
            <Input
              id="t-week"
              type="number"
              min={1}
              max={12}
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              required={!!task}
            />
          </div>
        </div>
        {localError && <ErrorState message={localError} />}
        {save.isError && <ErrorState message={errorMessage(save.error)} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : task ? "Save changes" : "Assign task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ detail

function TaskDetailModal({
  task,
  onClose,
  onEdit,
  onDeleted,
}: {
  task: InternTask;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState(task.mentor_feedback ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const subs = useQuery({
    queryKey: ["internship", "submissions", task.id],
    queryFn: () => internshipApi.submissions(task.id),
  });

  const decide = useMutation({
    mutationFn: (status: "Done" | "Rework") =>
      internshipApi.patchTask(task.id, { status, mentor_feedback: feedback.trim() || null }),
    onMutate: () => setNotice(null),
    onSuccess: (t) => {
      setNotice(t.status === "Done" ? "Task marked Done." : "Rework requested. The intern can see your feedback.");
      invalidateTaskData(qc);
    },
  });
  const del = useMutation({
    mutationFn: () => internshipApi.deleteTask(task.id),
    onSuccess: () => {
      invalidateTaskData(qc);
      onDeleted();
    },
  });

  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority} priority</Badge>
          <Badge>
            Week {task.week_number} · Month {task.month_number}
          </Badge>
          {task.due_date && <Badge>Due {task.due_date}</Badge>}
          {task.flagged_blocked_at && <Badge tone="warning">Flagged blocked {fmtDateTime(task.flagged_blocked_at)}</Badge>}
        </div>
        <p className="text-sm text-muted">
          {task.mentee_name} · {task.skill_area}
          {task.skill_tags.length > 0 && ` · ${task.skill_tags.join(", ")}`} · last activity {fmtDateTime(task.last_activity_at)}
        </p>
        {task.description && <p className="whitespace-pre-line text-sm text-text">{task.description}</p>}
        {task.acceptance_criteria && (
          <div>
            <p className="text-xs font-medium text-muted">Acceptance criteria</p>
            <p className="whitespace-pre-line text-sm text-text">{task.acceptance_criteria}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="destructive" size="sm" disabled={del.isPending} onClick={() => del.mutate()}>
                Confirm delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
        {del.isError && <ErrorState message={errorMessage(del.error)} />}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Submissions</h3>
          {subs.isPending ? (
            <LoadingState rows={2} />
          ) : subs.isError ? (
            <ErrorState message={errorMessage(subs.error)} onRetry={() => subs.refetch()} />
          ) : subs.data.length === 0 ? (
            <EmptyState message="The intern hasn’t submitted anything for this task yet." />
          ) : (
            subs.data.map((s, i) => <SubmissionItem key={s.id} sub={s} defaultOpen={i === 0} />)
          )}
        </section>

        <section className="space-y-2 rounded-xl border border-border p-4">
          <Label htmlFor="fb">Your feedback to the intern</Label>
          <Textarea id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          {notice && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              <CheckCircle2 className="size-4" aria-hidden="true" /> {notice}
            </p>
          )}
          {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={decide.isPending || task.status === "Rework" || !feedback.trim()}
              title={!feedback.trim() ? "Add feedback explaining what to rework" : undefined}
              onClick={() => decide.mutate("Rework")}
            >
              <RotateCcw /> Request rework
            </Button>
            <Button disabled={decide.isPending || task.status === "Done"} onClick={() => decide.mutate("Done")}>
              <CheckCircle2 /> Mark Done
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function SubmissionItem({ sub, defaultOpen }: { sub: Submission; defaultOpen: boolean }) {
  const qc = useQueryClient();
  const [showCode, setShowCode] = useState(defaultOpen);
  const aiRetry = useMutation({
    mutationFn: () => internshipApi.requestAiReview(sub.id),
    onSuccess: () => {
      for (const key of ["submissions", "tasks", "approvals", "overview"]) qc.invalidateQueries({ queryKey: ["internship", key] });
    },
  });
  const findings = sub.review?.findings ?? [];
  const metrics = sub.review?.metrics ?? {};
  const canRetry = sub.review_status === "agent_unavailable" || sub.review_status === "agent_failed";

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <FileCode className="size-4 text-muted" aria-hidden="true" />
          <span className="font-medium text-text">{sub.filename || "Submission"}</span>
          {sub.language && <Badge>{sub.language}</Badge>}
          <span className="text-xs text-muted">{fmtDateTime(sub.created_at)}</span>
        </div>
        <Badge tone={sub.review_status === "awaiting_mentor" ? "ai" : sub.review_status === "published" ? "success" : "neutral"}>
          {reviewStatusLabel(sub.review_status)}
        </Badge>
      </div>
      {sub.notes && <p className="text-sm text-text">Notes: {sub.notes}</p>}
      {sub.submission_url && (
        <a
          href={sub.submission_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary-700 underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" /> {sub.submission_url}
        </a>
      )}
      {sub.review_status === "awaiting_mentor" && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-ai-50 px-3 py-2 text-sm text-ai-700">
          <Sparkles className="size-4" aria-hidden="true" /> An AI review draft is waiting for you.
          <Link to={INBOX} className="font-medium underline underline-offset-4">
            Open AI Approval Inbox
          </Link>
        </p>
      )}
      {canRetry && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={aiRetry.isPending} onClick={() => aiRetry.mutate()}>
            <Sparkles /> {aiRetry.isPending ? "Requesting…" : "Request AI review"}
          </Button>
        </div>
      )}
      {aiRetry.isSuccess && (
        <p role="status" className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
          AI review requested ({reviewStatusLabel(aiRetry.data.review_status)}). Drafts appear in your AI Approval Inbox.
        </p>
      )}
      {aiRetry.isError && <ErrorState message={errorMessage(aiRetry.error)} />}

      {sub.code && (
        <div>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowCode((v) => !v)}>
            {showCode ? "Hide code" : "Show code"}
          </Button>
          {showCode && <CodeView code={sub.code} findings={findings} />}
        </div>
      )}
      {sub.review && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Automated findings (deterministic)</p>
          {findings.length === 0 ? (
            <p className="text-sm text-muted">No automated findings.</p>
          ) : (
            <ul className="space-y-1">
              {findings.map((f, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                  <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
                  <span className="font-mono text-xs text-muted">L{f.line}</span>
                  <span className="font-mono text-xs text-muted">{f.rule}</span>
                  <span className="text-text">{f.message}</span>
                </li>
              ))}
            </ul>
          )}
          {Object.keys(metrics).length > 0 && (
            <dl className="flex flex-wrap gap-2">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-muted px-2 py-1 text-xs">
                  <dt className="inline text-muted">{k.replace(/_/g, " ")}: </dt>
                  <dd className="inline font-semibold text-text">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

function CodeView({ code, findings }: { code: string; findings: CodeFinding[] }) {
  const rank = { high: 3, medium: 2, low: 1 } as const;
  const worst = new Map<number, CodeFinding["severity"]>();
  for (const f of findings) {
    const cur = worst.get(f.line);
    if (!cur || rank[f.severity] > rank[cur]) worst.set(f.line, f.severity);
  }
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-border bg-surface-muted">
      <table className="w-full border-collapse font-mono text-xs">
        <tbody>
          {lines.map((ln, i) => {
            const sev = worst.get(i + 1);
            return (
              <tr key={i} className={sev ? SEVERITY_ROW[sev] : undefined}>
                <td className="w-10 select-none border-r border-border px-2 text-right align-top text-subtle">{i + 1}</td>
                <td className="whitespace-pre px-3 text-text">{ln || " "}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ weekly quiz generation

function QuizGenerator({ mentees }: { mentees: { data: Mentee[] | undefined; isPending: boolean; isError: boolean } }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-ai-500" aria-hidden="true" /> Weekly quiz
          </CardTitle>
          <CardDescription>
            The quiz agent drafts multiple-choice questions from the intern’s tasks for that week. The draft lands in
            your AI Approval Inbox; the intern sees nothing until you approve it.
          </CardDescription>
        </div>
      </CardHeader>
      {mentees.isPending ? (
        <LoadingState rows={2} />
      ) : mentees.isError || !mentees.data ? (
        <ErrorState message="Could not load your interns." />
      ) : mentees.data.length === 0 ? (
        <EmptyState message="No interns are assigned to you yet." />
      ) : (
        <ul className="divide-y divide-border">
          {mentees.data.map((m) => (
            <QuizRow key={m.id} mentee={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function quizOutcome(q: WeeklyQuiz): { tone: "success" | "warning"; text: string } {
  switch (q.status) {
    case "awaiting_mentor":
      return { tone: "success", text: `Week ${q.week_number} quiz drafted. Review it in the AI Approval Inbox.` };
    case "drafting":
      return { tone: "success", text: `Week ${q.week_number} quiz is being drafted. It will appear in the AI Approval Inbox.` };
    case "failed":
      return { tone: "warning", text: `The quiz agent could not draft the week ${q.week_number} quiz. Try again later.` };
    default:
      return { tone: "warning", text: `A week ${q.week_number} quiz already exists (status: ${q.status.replace(/_/g, " ")}).` };
  }
}

function QuizRow({ mentee }: { mentee: Mentee }) {
  const qc = useQueryClient();
  const [week, setWeek] = useState("");
  const gen = useMutation({
    mutationFn: () => internshipApi.generateQuiz(mentee.id, week.trim() ? Number(week) : undefined),
    onSuccess: () => {
      for (const key of ["approvals", "overview"]) qc.invalidateQueries({ queryKey: ["internship", key] });
    },
  });
  const outcome = gen.isSuccess ? quizOutcome(gen.data) : null;
  const weekInvalid = week.trim() !== "" && !(Number.isInteger(Number(week)) && Number(week) >= 1 && Number(week) <= 12);

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">{mentee.name}</p>
          <p className="text-xs text-muted">Currently week {mentee.current_week}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <Label htmlFor={`qw-${mentee.id}`}>Week (optional)</Label>
            <Input
              id={`qw-${mentee.id}`}
              type="number"
              min={1}
              max={12}
              placeholder={String(mentee.current_week)}
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
          </div>
          <Button variant="secondary" disabled={gen.isPending || weekInvalid} onClick={() => gen.mutate()}>
            <Sparkles /> {gen.isPending ? "Generating…" : "Generate weekly quiz"}
          </Button>
        </div>
      </div>
      {outcome && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            outcome.tone === "success" ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-800",
          )}
        >
          {outcome.text}{" "}
          {outcome.tone === "success" && (
            <Link to={INBOX} className="font-medium underline underline-offset-4">
              Open inbox
            </Link>
          )}
        </p>
      )}
      {gen.isError && <ErrorState message={errorMessage(gen.error)} />}
    </li>
  );
}
