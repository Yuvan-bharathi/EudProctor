import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FileQuestion,
  Flag,
  HelpCircle,
  ListTodo,
  Play,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api";
import {
  internshipApi,
  reviewStatusLabel,
  type CodeReviewContent,
  type InternTask,
  type InternTaskStatus,
  type ReviewStatus,
  type Submission,
} from "@/lib/internshipApi";

// ------------------------------------------------------------------ helpers

const STAGES: { status: InternTaskStatus; label: string; tone: BadgeProps["tone"] }[] = [
  { status: "Assigned", label: "To do", tone: "neutral" },
  { status: "In Progress", label: "In progress", tone: "info" },
  { status: "Review", label: "Waiting for review", tone: "warning" },
  { status: "Rework", label: "Needs rework", tone: "danger" },
  { status: "Done", label: "Done", tone: "success" },
];
const STAGE_BY_STATUS = Object.fromEntries(STAGES.map((s) => [s.status, s])) as Record<
  InternTaskStatus,
  (typeof STAGES)[number]
>;

const PRIORITY_TONE: Record<InternTask["priority"], BadgeProps["tone"]> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

function reviewTone(s: ReviewStatus): BadgeProps["tone"] {
  if (s === "published") return "success";
  if (s === "awaiting_mentor" || s === "in_review" || s === "pending_review") return "warning";
  if (s === "none") return "neutral";
  return "info";
}

const EXT_LANG: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  java: "java",
  go: "go",
  rb: "ruby",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  php: "php",
  sql: "sql",
  html: "html",
  css: "css",
  kt: "kotlin",
  rs: "rust",
};

interface SecretScanDetail {
  message: string;
  findings: { line: number; kind?: string; message: string }[];
}

function secretScanDetail(err: unknown): SecretScanDetail | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const d = err.detail;
  if (d && typeof d === "object" && !Array.isArray(d) && "message" in d && "findings" in d) {
    const obj = d as { message: unknown; findings: unknown };
    if (typeof obj.message === "string" && Array.isArray(obj.findings))
      return { message: obj.message, findings: obj.findings as SecretScanDetail["findings"] };
  }
  return null;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

// ------------------------------------------------------------------ page

export function MenteeTasksPage() {
  usePageTitle("My Tasks");
  const tasks = useQuery({ queryKey: ["internship", "tasks"], queryFn: () => internshipApi.tasks() });
  const [filter, setFilter] = useState<InternTaskStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = tasks.data ?? [];
  const openTask = all.find((t) => t.id === openId) ?? null;
  const stages = filter === "all" ? STAGES : STAGES.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="primary">
          <ListTodo className="size-3.5" aria-hidden="true" />
          <span>Tasks & deliverables</span>
        </Badge>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text sm:text-2xl">My Tasks</h1>
        <p className="text-xs text-muted">
          Start a task, flag it if you're blocked, and submit your work with notes, a link or code for your mentor's
          review.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <FileQuestion className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs text-muted">Your mentor also releases a weekly knowledge check on what you're working on.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/candidate/internship/mcq">Weekly MCQs →</Link>
        </Button>
      </div>

      {/* Status filter */}
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[{ status: "all" as const, label: "All" }, ...STAGES].map((s) => {
          const count = s.status === "all" ? all.length : all.filter((t) => t.status === s.status).length;
          const active = filter === s.status;
          return (
            <button
              key={s.status}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(s.status)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary-200 bg-primary-50 text-primary-700"
                  : "border-border bg-surface text-muted hover:bg-surface-muted"
              }`}
            >
              {s.label} · {count}
            </button>
          );
        })}
      </div>

      {tasks.isPending ? (
        <LoadingState rows={5} label="Loading tasks" />
      ) : tasks.isError ? (
        <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState message="You have no tasks yet. Your mentor will assign your first one soon." />
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${filter === "all" ? "lg:grid-cols-5" : ""}`}>
          {stages.map((col) => {
            const colTasks = all.filter((t) => t.status === col.status);
            return (
              <section
                key={col.status}
                aria-label={col.label}
                className="flex flex-col rounded-xl border border-border bg-surface-muted p-3"
              >
                <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-text">{col.label}</span>
                  <Badge tone={col.tone}>{colTasks.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onOpen={() => setOpenId(task.id)} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-center text-[11px] text-muted">
                      No tasks
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {openTask && <TaskDialog key={openTask.id} task={openTask} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ cards

function TaskCard({ task, onOpen }: { task: InternTask; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-xl border border-border bg-surface p-3.5 text-left shadow-sm transition-colors hover:border-primary-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-semibold text-muted">
          M{task.month_number} · W{task.week_number}
        </span>
        <Badge tone={PRIORITY_TONE[task.priority]} className="text-[10px]">
          {task.priority}
        </Badge>
      </div>
      <h4 className="mt-2 text-xs font-semibold text-text">{task.title}</h4>
      {task.skill_area && <p className="mt-0.5 text-[11px] text-muted">{task.skill_area}</p>}
      {task.flagged_blocked_at && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning-800">
          <Flag className="size-3" aria-hidden="true" /> Flagged blocked
        </p>
      )}
      {task.status === "Rework" && task.mentor_feedback && (
        <p className="mt-1.5 line-clamp-2 rounded-lg bg-danger-50 p-1.5 text-[11px] text-danger-700">
          Rework: {task.mentor_feedback}
        </p>
      )}
      {task.latest_submission && (
        <p className="mt-1.5 text-[11px] text-muted">{reviewStatusLabel(task.latest_submission.review_status)}</p>
      )}
      <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted">Due: {task.due_date ?? "—"}</p>
    </button>
  );
}

// ------------------------------------------------------------------ dialog

function TaskDialog({ task, onClose }: { task: InternTask; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"view" | "blocked" | "submit">("view");
  const [blockReason, setBlockReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const invalidateTask = () => {
    qc.invalidateQueries({ queryKey: ["internship", "tasks"] });
    qc.invalidateQueries({ queryKey: ["internship", "me"] });
  };

  const start = useMutation({
    mutationFn: () => internshipApi.startTask(task.id),
    onSuccess: () => {
      setNotice("Task started.");
      invalidateTask();
    },
  });
  const blocked = useMutation({
    mutationFn: () => internshipApi.flagBlocked(task.id, blockReason.trim()),
    onSuccess: () => {
      setMode("view");
      setBlockReason("");
      setNotice("Your mentor has been told you're blocked on this task.");
      invalidateTask();
    },
  });

  const canStart = task.status === "Assigned" || task.status === "Rework";
  const canSubmit = task.status === "In Progress" || task.status === "Rework";
  const canFlag = task.status !== "Done";
  const actionError = start.error ?? blocked.error;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-text/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dlg-title"
        className="my-8 w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STAGE_BY_STATUS[task.status].tone}>{task.status}</Badge>
              <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority} priority</Badge>
              {task.flagged_blocked_at && (
                <Badge tone="warning">
                  <Flag className="size-3" aria-hidden="true" /> Flagged blocked {fmtDate(task.flagged_blocked_at)}
                </Badge>
              )}
            </div>
            <h3 id="task-dlg-title" className="mt-2 text-base font-semibold text-text">
              {task.title}
            </h3>
            <p className="text-xs text-muted">
              Month {task.month_number}, Week {task.week_number}
              {task.skill_area && ` · ${task.skill_area}`} · Due {task.due_date ?? "—"}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {task.description && <p className="whitespace-pre-wrap text-text">{task.description}</p>}
          {task.acceptance_criteria && (
            <div>
              <p className="font-semibold text-text">Acceptance criteria</p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{task.acceptance_criteria}</p>
            </div>
          )}
          {task.skill_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.skill_tags.map((t) => (
                <Badge key={t} tone="neutral">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {task.mentor_feedback && (
            <div
              className={`rounded-lg p-3 ${
                task.status === "Rework" ? "bg-danger-50 text-danger-700" : "bg-primary-50 text-primary-700"
              }`}
            >
              <p className="font-semibold">
                {task.status === "Rework" ? "Your mentor asked for rework" : "Mentor feedback"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{task.mentor_feedback}</p>
            </div>
          )}

          {notice && (
            <p role="status" className="flex items-center gap-1.5 rounded-lg bg-success-50 p-2 text-success-700">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {notice}
            </p>
          )}
          {actionError && <ErrorState message={errorMessage(actionError)} />}

          {mode === "view" && (
            <div className="flex flex-wrap items-center gap-2">
              {canStart && (
                <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
                  <Play aria-hidden="true" />
                  {start.isPending ? "Starting…" : task.status === "Rework" ? "Resume work" : "Start task"}
                </Button>
              )}
              {canSubmit && (
                <Button
                  size="sm"
                  variant={canStart ? "secondary" : "primary"}
                  onClick={() => {
                    setNotice(null);
                    setMode("submit");
                  }}
                >
                  <Upload aria-hidden="true" />
                  Submit work
                </Button>
              )}
              {canFlag && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setNotice(null);
                    setMode("blocked");
                  }}
                >
                  <Flag aria-hidden="true" />
                  I'm blocked
                </Button>
              )}
            </div>
          )}

          {mode === "blocked" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                blocked.mutate();
              }}
              className="space-y-2 rounded-lg border border-border p-3"
            >
              <Label htmlFor="blk-reason">What's blocking you? (sent to your mentor)</Label>
              <Textarea
                id="blk-reason"
                rows={3}
                className="min-h-0"
                required
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={blocked.isPending || !blockReason.trim()}>
                  {blocked.isPending ? "Sending…" : "Alert my mentor"}
                </Button>
              </div>
            </form>
          )}

          {mode === "submit" && (
            <SubmitForm
              task={task}
              onCancel={() => setMode("view")}
              onDone={() => {
                setMode("view");
                setNotice("Submitted for review.");
              }}
            />
          )}

          <Submissions taskId={task.id} />
        </div>
      </div>
    </div>
  );
}

function SubmitForm({ task, onCancel, onDone }: { task: InternTask; onCancel: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("");
  const [language, setLanguage] = useState("");
  const [consent, setConsent] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const hasCode = code.trim().length > 0;

  const submit = useMutation({
    mutationFn: () =>
      internshipApi.submitTask(task.id, {
        notes: notes.trim(),
        submission_url: url.trim() || undefined,
        code: hasCode ? code : undefined,
        filename: hasCode && filename.trim() ? filename.trim() : undefined,
        language: hasCode && language.trim() ? language.trim() : undefined,
        ai_consent: hasCode && consent,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internship", "tasks"] });
      qc.invalidateQueries({ queryKey: ["internship", "submissions", task.id] });
      qc.invalidateQueries({ queryKey: ["internship", "me"] });
      onDone();
    },
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;
    try {
      setCode(await file.text());
      setFilename(file.name);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (EXT_LANG[ext]) setLanguage(EXT_LANG[ext]);
    } catch {
      setFileError("Couldn't read that file as text.");
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };

  const scan = secretScanDetail(submit.error);
  const empty = !notes.trim() && !url.trim() && !hasCode;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold text-text">Submit your work</h4>
      <div>
        <Label htmlFor="sub-notes">Notes for your mentor</Label>
        <Textarea
          id="sub-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What you built, how you tested it, anything you're unsure about…"
        />
      </div>
      <div>
        <Label htmlFor="sub-url">Link (optional)</Label>
        <Input
          id="sub-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/…/pull/12"
        />
      </div>

      <fieldset className="space-y-2 rounded-lg bg-surface-muted p-3">
        <legend className="px-1 text-xs font-medium text-muted">Code (optional)</legend>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500">
            <FileCode2 className="size-3.5 text-muted" aria-hidden="true" />
            Upload a file
            <input type="file" className="sr-only" onChange={onFile} />
          </label>
          <span className="text-[11px] text-muted">or paste below</span>
        </div>
        {fileError && <p className="text-[11px] text-danger-700">{fileError}</p>}
        <Label htmlFor="sub-code" className="sr-only">
          Code
        </Label>
        <Textarea
          id="sub-code"
          rows={8}
          className="font-mono text-xs"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code here"
          spellCheck={false}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="sub-fn">Filename</Label>
            <Input id="sub-fn" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="app.py" />
          </div>
          <div>
            <Label htmlFor="sub-lang">Language</Label>
            <Input
              id="sub-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="python"
            />
          </div>
        </div>
        {hasCode && (
          <label className="flex items-start gap-2 text-xs text-text">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary-600"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Send this code to the AI reviewer (your mentor approves the feedback before you see it)</span>
          </label>
        )}
        <p className="text-[11px] text-muted">
          Never include passwords, API keys or tokens. Code with secrets is rejected and not saved.
        </p>
      </fieldset>

      {scan ? (
        <div role="alert" className="rounded-lg bg-danger-50 p-3 text-xs text-danger-700">
          <p className="flex items-start gap-1.5 font-semibold">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {scan.message}
          </p>
          {scan.findings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {scan.findings.map((f, i) => (
                <li key={`${f.line}-${i}`}>
                  {f.line > 0 ? `Line ${f.line}: ` : ""}
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        submit.isError && <ErrorState message={errorMessage(submit.error)} />
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submit.isPending || empty}>
          {submit.isPending ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ submissions & reviews

function Submissions({ taskId }: { taskId: string }) {
  const subs = useQuery({
    queryKey: ["internship", "submissions", taskId],
    queryFn: () => internshipApi.submissions(taskId),
  });

  return (
    <section aria-labelledby="subs-h" className="border-t border-border pt-4">
      <h4 id="subs-h" className="mb-2 text-sm font-semibold text-text">
        My submissions
      </h4>
      {subs.isPending ? (
        <LoadingState rows={2} label="Loading submissions" />
      ) : subs.isError ? (
        <ErrorState message={errorMessage(subs.error)} onRetry={() => subs.refetch()} />
      ) : subs.data.length === 0 ? (
        <p className="text-xs text-muted">Nothing submitted yet.</p>
      ) : (
        <ul className="space-y-3">
          {subs.data.map((s) => (
            <SubmissionItem key={s.id} sub={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmissionItem({ sub }: { sub: Submission }) {
  const published = sub.review?.status === "published" ? sub.review : null;
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">{fmtDate(sub.created_at)}</span>
        <Badge tone={reviewTone(sub.review_status)}>{reviewStatusLabel(sub.review_status)}</Badge>
      </div>
      {sub.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-text">{sub.notes}</p>}
      {sub.submission_url && (
        <a
          href={sub.submission_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block break-all text-xs text-primary-700 underline-offset-4 hover:underline"
        >
          {sub.submission_url}
        </a>
      )}
      {sub.code && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted">
            Code{sub.filename ? `: ${sub.filename}` : ""}
            {sub.language ? ` (${sub.language})` : ""}
            {sub.ai_consent ? " · sent to AI reviewer" : ""}
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-[11px] text-text">
            {sub.code.split("\n").map((line, i) => (
              <div key={i}>
                <span className="mr-3 inline-block w-8 text-right text-subtle select-none">{i + 1}</span>
                {line}
              </div>
            ))}
          </pre>
        </details>
      )}
      {published?.review && <ReviewView review={published.review} findings={published.findings} publishedAt={published.published_at} />}
    </li>
  );
}

function ReviewView({
  review,
  findings,
  publishedAt,
}: {
  review: CodeReviewContent;
  findings: NonNullable<Submission["review"]>["findings"];
  publishedAt: string | null;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Approved by your mentor
        </Badge>
        <Badge tone="ai">
          <Sparkles className="size-3" aria-hidden="true" />
          AI-assisted review
        </Badge>
        {publishedAt && <span className="text-muted">{fmtDate(publishedAt)}</span>}
      </div>

      {review.summary && <p className="mt-3 whitespace-pre-wrap text-text">{review.summary}</p>}

      {review.strengths.length > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-success-700">What you did well</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {review.socratic_questions.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 font-semibold text-text">
            <HelpCircle className="size-3.5 text-muted" aria-hidden="true" />
            Questions to think about
          </p>
          <ol className="mt-1.5 space-y-2">
            {review.socratic_questions.map((q, i) => (
              <li key={i} className="rounded-lg bg-surface-muted p-2.5">
                <div className="flex items-start gap-2">
                  {q.line != null && (
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">
                      line {q.line}
                    </span>
                  )}
                  <p className="font-medium text-text">{q.question}</p>
                </div>
                {q.why_it_matters && (
                  <p className="mt-1 text-muted">
                    <span className="font-medium">Why it matters:</span> {q.why_it_matters}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {review.findings_explained.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 font-semibold text-text">
            <AlertTriangle className="size-3.5 text-muted" aria-hidden="true" />
            Things the checks found
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {review.findings_explained.map((f, i) => {
              const lines = findings.filter((x) => x.rule === f.rule).map((x) => x.line);
              return (
                <li key={i} className="rounded-lg border border-border p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-semibold text-text">{f.rule}</span>
                    {lines.length > 0 && (
                      <span className="text-[11px] text-muted">
                        line{lines.length > 1 ? "s" : ""} {lines.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-muted">{f.explanation}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
