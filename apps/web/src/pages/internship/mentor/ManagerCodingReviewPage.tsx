import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCode, Lock, Plus, ShieldCheck, Sparkles, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import {
  type AgentKind,
  type AppraisalContent,
  type AppraisalMetrics,
  type ApprovalDraft,
  type CodeFinding,
  type CodeReviewContent,
  type QuizQuestion,
  internshipApi,
  reviewStatusLabel,
} from "@/lib/internshipApi";
import { cn } from "@/lib/utils";

type StatusTab = "pending" | "approved" | "rejected";

const AGENT_LABEL: Record<AgentKind, string> = {
  code_review: "Code review",
  weekly_quiz: "Weekly quiz",
  appraisal: "Appraisal",
};

const SEVERITY_TONE = { high: "danger", medium: "warning", low: "info" } as const;
const SEVERITY_ROW = { high: "bg-danger-50", medium: "bg-warning-50", low: "bg-info-50" } as const;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

// ------------------------------------------------------------------ page

export function ManagerCodingReviewPage() {
  usePageTitle("AI Approval Inbox");
  const [tab, setTab] = useState<StatusTab>("pending");
  const [agent, setAgent] = useState<AgentKind | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["internship", "approvals", tab, agent || "all"],
    queryFn: () => internshipApi.approvals({ status: tab, agent: agent || undefined }),
  });
  // Unfiltered pending list feeds the count badge (shared with the hub's preview).
  const pendingAll = useQuery({
    queryKey: ["internship", "approvals", "pending", "all"],
    queryFn: () => internshipApi.approvals({ status: "pending" }),
  });
  const pendingCount = pendingAll.data?.length;

  const tabs: { id: StatusTab; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="ai">
            <Sparkles aria-hidden="true" /> AI drafts
          </Badge>
          <h1 className="mt-1 text-xl font-semibold text-text sm:text-2xl">AI Approval Inbox</h1>
          <p className="text-sm text-muted">
            Code reviews, weekly quizzes and appraisals drafted by the AI agents for your interns.
          </p>
        </div>
        <div>
          <Label htmlFor="agent-filter">Agent</Label>
          <Select
            id="agent-filter"
            value={agent}
            onChange={(e) => {
              setAgent(e.target.value as AgentKind | "");
              setSelectedId(null);
            }}
          >
            <option value="">All agents</option>
            <option value="code_review">Code review</option>
            <option value="weekly_quiz">Weekly quiz</option>
            <option value="appraisal">Appraisal</option>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm text-ai-700">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          Nothing in this inbox reaches the intern until you approve it. Rejected drafts are never shown to them.
        </p>
      </div>

      <div role="tablist" aria-label="Draft status" className="inline-flex rounded-lg bg-surface-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setSelectedId(null);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
              tab === t.id ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            {t.id === "pending" && pendingCount !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  pendingCount > 0 ? "bg-ai-100 text-ai-700" : "bg-surface text-muted",
                )}
                aria-label={`${pendingCount} pending`}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-4">
          {list.isPending ? (
            <LoadingState rows={5} />
          ) : list.isError ? (
            <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.data.length === 0 ? (
            <EmptyState message={tab === "pending" ? "No drafts are waiting for you." : `No ${tab} drafts.`} />
          ) : (
            <ul className="space-y-2">
              {list.data.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    aria-current={selectedId === d.id}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                      selectedId === d.id
                        ? "border-primary-500 bg-primary-50"
                        : "border-border bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="ai">{AGENT_LABEL[d.agent]}</Badge>
                      <DraftStatusBadge draft={d} />
                    </div>
                    <p className="mt-2 text-sm font-medium text-text">{d.title}</p>
                    <p className="text-xs text-muted">
                      {d.mentee_name} · {fmtDateTime(d.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-8">
          {selectedId ? (
            <DraftPanel id={selectedId} onDecided={() => setSelectedId(null)} />
          ) : (
            <EmptyState message="Select a draft to review it." />
          )}
        </div>
      </div>
    </div>
  );
}

function DraftStatusBadge({ draft }: { draft: ApprovalDraft }) {
  if (draft.status === "pending") return <Badge tone="warning">Awaiting you</Badge>;
  if (draft.status === "approved")
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden="true" /> Approved{draft.edited ? " (edited)" : ""}
      </Badge>
    );
  return (
    <Badge tone="danger">
      <XCircle aria-hidden="true" /> Rejected
    </Badge>
  );
}

// ------------------------------------------------------------------ detail

function DraftPanel({ id, onDecided }: { id: string; onDecided: () => void }) {
  const q = useQuery({ queryKey: ["internship", "approval", id], queryFn: () => internshipApi.approval(id) });
  if (q.isPending) return <LoadingState rows={6} />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <DraftDetail key={q.data.id} draft={q.data} onDecided={onDecided} />;
}

function asReview(c: Record<string, unknown>): CodeReviewContent {
  const r = c as Partial<CodeReviewContent>;
  return {
    summary: r.summary ?? "",
    strengths: r.strengths ?? [],
    socratic_questions: (r.socratic_questions ?? []).map((s) => ({
      line: s.line ?? null,
      question: s.question ?? "",
      why_it_matters: s.why_it_matters ?? "",
    })),
    findings_explained: (r.findings_explained ?? []).map((f) => ({ rule: f.rule ?? "", explanation: f.explanation ?? "" })),
    mentor_walkthrough_questions: r.mentor_walkthrough_questions ?? [],
  };
}

function allowedSkills(c: Record<string, unknown>): string[] {
  const s = c.allowed_skills;
  return Array.isArray(s) && s.length > 0 ? (s as string[]) : ["General Engineering"];
}

function asQuiz(c: Record<string, unknown>): QuizQuestion[] {
  const allowed = allowedSkills(c);
  const qs = Array.isArray(c.questions) ? (c.questions as QuizQuestion[]) : [];
  return qs.map((qq, i) => ({
    id: qq.id ?? `q${i + 1}`,
    skill: allowed.find((s) => s.toLowerCase() === (qq.skill ?? "").trim().toLowerCase()) ?? allowed[0],
    body: qq.body ?? "",
    options: OPTION_KEYS.map((key) => {
      const o = (qq.options ?? []).find((x) => (x.key ?? "").toUpperCase() === key);
      return { key, text: o?.text ?? "", misconception: o?.misconception ?? null };
    }),
    correct_key: (qq.correct_key ?? "A").toUpperCase(),
    explanation: qq.explanation ?? "",
  }));
}

function asAppraisal(c: Record<string, unknown>): AppraisalContent {
  const a = c as Partial<AppraisalContent>;
  return {
    qualitative_summary: a.qualitative_summary ?? "",
    strengths: a.strengths ?? [],
    growth_areas: a.growth_areas ?? [],
    next_goals: a.next_goals ?? [],
    mentor_brief: a.mentor_brief ?? "",
    self_appraisal_scaffold: {
      accomplishments: a.self_appraisal_scaffold?.accomplishments ?? [],
      challenges: a.self_appraisal_scaffold?.challenges ?? [],
      focus_goals: a.self_appraisal_scaffold?.focus_goals ?? [],
    },
  };
}

function DraftDetail({ draft, onDecided }: { draft: ApprovalDraft; onDecided: () => void }) {
  const qc = useQueryClient();
  const pending = draft.status === "pending";
  const source = (pending ? draft.content : (draft.final_content ?? draft.content)) ?? {};

  const [review, setReview] = useState(() => asReview(source));
  const [quiz, setQuiz] = useState(() => asQuiz(source));
  const [appraisal, setAppraisal] = useState(() => asAppraisal(source));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const build = (r: CodeReviewContent, qs: QuizQuestion[], a: AppraisalContent): Record<string, unknown> => {
    if (draft.agent === "code_review") return { ...r };
    if (draft.agent === "weekly_quiz") return { ...source, questions: qs };
    return { ...a }; // appraisal: never send the read-only metrics
  };
  const [baseline] = useState(() => JSON.stringify(build(asReview(source), asQuiz(source), asAppraisal(source))));
  const edited = build(review, quiz, appraisal);
  const dirty = JSON.stringify(edited) !== baseline;

  const decide = useMutation({
    mutationFn: (body: { action: "approve" | "reject"; content?: Record<string, unknown>; note?: string }) =>
      internshipApi.decide(draft.id, body),
    onSuccess: () => {
      for (const key of ["approvals", "approval", "overview", "tasks", "submissions"])
        qc.invalidateQueries({ queryKey: ["internship", key] });
      onDecided();
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ai">
                <Sparkles aria-hidden="true" /> {AGENT_LABEL[draft.agent]}
              </Badge>
              <DraftStatusBadge draft={draft} />
            </div>
            <CardTitle className="mt-2">{draft.title}</CardTitle>
            <CardDescription>
              {draft.mentee_name} · drafted {fmtDateTime(draft.created_at)}
              {draft.decided_at && <> · decided {fmtDateTime(draft.decided_at)}</>}
            </CardDescription>
          </div>
        </CardHeader>
        {draft.mentor_note && (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-text">
            <span className="font-medium">Your note:</span> {draft.mentor_note}
          </p>
        )}
      </Card>

      {draft.agent === "code_review" && <CodeReviewContext draft={draft} />}

      <div className={cn("rounded-xl border p-5", pending ? "border-ai-100 bg-ai-50" : "border-border bg-surface")}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Sparkles className="size-4 text-ai-500" aria-hidden="true" />
            {pending ? "AI draft — edit before approving" : "Content as decided"}
          </h2>
          {pending && dirty && <Badge tone="primary">Edited</Badge>}
        </div>
        {draft.agent === "code_review" && <ReviewEditor value={review} onChange={setReview} disabled={!pending} />}
        {draft.agent === "weekly_quiz" && (
          <QuizEditor value={quiz} onChange={setQuiz} allowed={allowedSkills(source)} disabled={!pending} />
        )}
        {draft.agent === "appraisal" && (
          <AppraisalEditor
            value={appraisal}
            onChange={setAppraisal}
            metrics={(source.metrics ?? null) as AppraisalMetrics | null}
            disabled={!pending}
          />
        )}
      </div>

      {pending && (
        <Card className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {draft.mentee_name} sees nothing from this draft until you approve it.
          </p>
          {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
          {rejecting ? (
            <div className="space-y-2">
              <Label htmlFor="reject-note">Note (optional, for the record)</Label>
              <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setRejecting(false)} disabled={decide.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ action: "reject", note: note.trim() || undefined })}
                >
                  Confirm reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={decide.isPending}>
                Reject
              </Button>
              <Button
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ action: "approve" })}
                title={dirty ? "Your edits will be discarded" : undefined}
              >
                Approve as drafted
              </Button>
              <Button
                disabled={decide.isPending || !dirty}
                onClick={() => decide.mutate({ action: "approve", content: edited })}
              >
                Approve with my edits
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ code review context

function CodeReviewContext({ draft }: { draft: ApprovalDraft }) {
  const { task, submission } = draft;
  const findings = submission?.review?.findings ?? [];
  const metrics = submission?.review?.metrics ?? {};
  return (
    <>
      {task && (
        <Card>
          <CardTitle>{task.title}</CardTitle>
          <p className="mt-1 text-xs text-muted">
            {task.skill_area} · Week {task.week_number} · Status {task.status}
          </p>
          {task.description && <p className="mt-3 whitespace-pre-line text-sm text-text">{task.description}</p>}
          {task.acceptance_criteria && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted">Acceptance criteria</p>
              <p className="whitespace-pre-line text-sm text-text">{task.acceptance_criteria}</p>
            </div>
          )}
        </Card>
      )}
      {submission ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <FileCode className="size-4 text-muted" aria-hidden="true" />
              {submission.filename || "Submitted code"}
              {submission.language && <Badge>{submission.language}</Badge>}
            </h2>
            <span className="text-xs text-muted">
              {fmtDateTime(submission.created_at)} · {reviewStatusLabel(submission.review_status)}
            </span>
          </div>
          {submission.notes && <p className="text-sm text-text">Intern notes: {submission.notes}</p>}
          {submission.submission_url && (
            <a
              href={submission.submission_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary-700 underline-offset-4 hover:underline"
            >
              {submission.submission_url}
            </a>
          )}
          {submission.code ? (
            <CodeView code={submission.code} findings={findings} />
          ) : (
            <p className="text-sm text-muted">No code was attached to this submission.</p>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Automated findings (deterministic)</h3>
            {findings.length === 0 ? (
              <p className="text-sm text-muted">No automated findings.</p>
            ) : (
              <ul className="space-y-1.5">
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
          </div>
          {Object.keys(metrics).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Metrics</h3>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(metrics).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-muted px-3 py-2">
                    <dt className="text-xs text-muted">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-sm font-semibold text-text">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      ) : (
        <ErrorState message="The submission for this draft could not be loaded." />
      )}
    </>
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
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-surface-muted">
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

// ------------------------------------------------------------------ editors

function StringListEditor({
  label,
  items,
  onChange,
  disabled,
  max,
  min = 0,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
  max?: number;
  min?: number;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-medium text-muted">
        {label}
        {max !== undefined && ` (max ${max})`}
      </legend>
      {items.length === 0 && <p className="text-sm text-subtle">None.</p>}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={`${label} ${i + 1}`}
            value={it}
            disabled={disabled}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label} ${i + 1}`}
              disabled={items.length <= min}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {!disabled && (max === undefined || items.length < max) && (
        <Button variant="secondary" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus /> Add
        </Button>
      )}
    </fieldset>
  );
}

function ReviewEditor({
  value,
  onChange,
  disabled,
}: {
  value: CodeReviewContent;
  onChange: (v: CodeReviewContent) => void;
  disabled: boolean;
}) {
  const set = <K extends keyof CodeReviewContent>(k: K, v: CodeReviewContent[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="rv-summary">Summary</Label>
        <Textarea
          id="rv-summary"
          value={value.summary}
          maxLength={1500}
          disabled={disabled}
          onChange={(e) => set("summary", e.target.value)}
        />
      </div>
      <StringListEditor
        label="Strengths"
        items={value.strengths}
        max={5}
        disabled={disabled}
        onChange={(v) => set("strengths", v)}
      />
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-medium text-muted">Socratic questions (1–6)</legend>
        {value.socratic_questions.map((sq, i) => {
          const upd = (patch: Partial<typeof sq>) =>
            set(
              "socratic_questions",
              value.socratic_questions.map((x, j) => (j === i ? { ...x, ...patch } : x)),
            );
          return (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <Label htmlFor={`sq-line-${i}`}>Line</Label>
                  <Input
                    id={`sq-line-${i}`}
                    type="number"
                    min={1}
                    value={sq.line ?? ""}
                    disabled={disabled}
                    onChange={(e) => upd({ line: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor={`sq-q-${i}`}>Question</Label>
                  <Input
                    id={`sq-q-${i}`}
                    value={sq.question}
                    disabled={disabled}
                    onChange={(e) => upd({ question: e.target.value })}
                  />
                </div>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove question ${i + 1}`}
                    disabled={value.socratic_questions.length <= 1}
                    onClick={() =>
                      set(
                        "socratic_questions",
                        value.socratic_questions.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div>
                <Label htmlFor={`sq-why-${i}`}>Why it matters</Label>
                <Input
                  id={`sq-why-${i}`}
                  value={sq.why_it_matters}
                  disabled={disabled}
                  onChange={(e) => upd({ why_it_matters: e.target.value })}
                />
              </div>
            </div>
          );
        })}
        {!disabled && value.socratic_questions.length < 6 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              set("socratic_questions", [...value.socratic_questions, { line: null, question: "", why_it_matters: "" }])
            }
          >
            <Plus /> Add question
          </Button>
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-medium text-muted">Findings explained</legend>
        {value.findings_explained.length === 0 && <p className="text-sm text-subtle">None.</p>}
        {value.findings_explained.map((fe, i) => {
          const upd = (patch: Partial<typeof fe>) =>
            set(
              "findings_explained",
              value.findings_explained.map((x, j) => (j === i ? { ...x, ...patch } : x)),
            );
          return (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={`fe-rule-${i}`}>Rule</Label>
                  <Input
                    id={`fe-rule-${i}`}
                    value={fe.rule}
                    disabled={disabled}
                    onChange={(e) => upd({ rule: e.target.value })}
                  />
                </div>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove explanation ${i + 1}`}
                    onClick={() =>
                      set(
                        "findings_explained",
                        value.findings_explained.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div>
                <Label htmlFor={`fe-exp-${i}`}>Explanation</Label>
                <Textarea
                  id={`fe-exp-${i}`}
                  className="min-h-16"
                  value={fe.explanation}
                  disabled={disabled}
                  onChange={(e) => upd({ explanation: e.target.value })}
                />
              </div>
            </div>
          );
        })}
        {!disabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set("findings_explained", [...value.findings_explained, { rule: "", explanation: "" }])}
          >
            <Plus /> Add explanation
          </Button>
        )}
      </fieldset>
      <StringListEditor
        label="Mentor walkthrough questions"
        items={value.mentor_walkthrough_questions}
        max={3}
        disabled={disabled}
        onChange={(v) => set("mentor_walkthrough_questions", v)}
      />
    </div>
  );
}

function QuizEditor({
  value,
  onChange,
  allowed,
  disabled,
}: {
  value: QuizQuestion[];
  onChange: (v: QuizQuestion[]) => void;
  allowed: string[];
  disabled: boolean;
}) {
  const upd = (i: number, patch: Partial<QuizQuestion>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  if (value.length === 0) return <p className="text-sm text-muted">This draft has no questions.</p>;
  return (
    <ol className="space-y-4">
      {value.map((qq, i) => (
        <li key={qq.id} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-end gap-3">
              <span className="pb-2 text-sm font-semibold text-text">Q{i + 1}</span>
              <div>
                <Label htmlFor={`qz-skill-${i}`}>Skill</Label>
                <Select
                  id={`qz-skill-${i}`}
                  value={qq.skill}
                  disabled={disabled}
                  onChange={(e) => upd(i, { skill: e.target.value })}
                >
                  {allowed.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                disabled={value.length <= 1}
                title={value.length <= 1 ? "Keep at least one question" : undefined}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 /> Remove question
              </Button>
            )}
          </div>
          <div>
            <Label htmlFor={`qz-body-${i}`}>Question</Label>
            <Textarea
              id={`qz-body-${i}`}
              className="min-h-16"
              value={qq.body}
              disabled={disabled}
              onChange={(e) => upd(i, { body: e.target.value })}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-muted">Options (select the correct answer)</legend>
            {qq.options.map((o, k) => (
              <div
                key={o.key}
                className={cn(
                  "grid grid-cols-[auto_1fr] items-start gap-2 rounded-lg p-2 sm:grid-cols-[auto_2fr_1fr]",
                  qq.correct_key === o.key ? "bg-success-50" : "bg-surface-muted",
                )}
              >
                <label className="flex items-center gap-1.5 pt-2 text-sm font-semibold text-text">
                  <input
                    type="radio"
                    name={`qz-correct-${qq.id}`}
                    checked={qq.correct_key === o.key}
                    disabled={disabled}
                    onChange={() => upd(i, { correct_key: o.key })}
                    aria-label={`Option ${o.key} is correct`}
                  />
                  {o.key}
                </label>
                <Input
                  aria-label={`Option ${o.key} text`}
                  value={o.text}
                  disabled={disabled}
                  onChange={(e) =>
                    upd(i, { options: qq.options.map((x, m) => (m === k ? { ...x, text: e.target.value } : x)) })
                  }
                />
                <Input
                  aria-label={`Option ${o.key} misconception tag`}
                  placeholder={qq.correct_key === o.key ? "Correct answer" : "Misconception tag"}
                  className="col-span-2 sm:col-span-1"
                  value={o.misconception ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    upd(i, {
                      options: qq.options.map((x, m) => (m === k ? { ...x, misconception: e.target.value || null } : x)),
                    })
                  }
                />
              </div>
            ))}
          </fieldset>
          <div>
            <Label htmlFor={`qz-exp-${i}`}>Explanation (shown after the intern submits)</Label>
            <Textarea
              id={`qz-exp-${i}`}
              className="min-h-16"
              value={qq.explanation ?? ""}
              disabled={disabled}
              onChange={(e) => upd(i, { explanation: e.target.value })}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text">{value ?? "—"}</dd>
    </div>
  );
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "Not enough data" : `${v}%`);

function AppraisalEditor({
  value,
  onChange,
  metrics,
  disabled,
}: {
  value: AppraisalContent;
  onChange: (v: AppraisalContent) => void;
  metrics: AppraisalMetrics | null;
  disabled: boolean;
}) {
  const set = <K extends keyof AppraisalContent>(k: K, v: AppraisalContent[K]) => onChange({ ...value, [k]: v });
  const setScaffold = (k: keyof AppraisalContent["self_appraisal_scaffold"], v: string[]) =>
    onChange({ ...value, self_appraisal_scaffold: { ...value.self_appraisal_scaffold, [k]: v } });
  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-surface-muted p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
          <Lock className="size-4 text-muted" aria-hidden="true" /> Metrics (calculated by the system, read-only)
        </h3>
        {metrics ? (
          <>
            <p className="mb-2 text-xs text-muted">
              Day {metrics.window?.milestone_day} window: {metrics.window?.start} to {metrics.window?.end}
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricTile label="Attendance rate" value={pct(metrics.attendance?.rate_pct)} />
              <MetricTile label="Days worked" value={metrics.attendance?.days_worked} />
              <MetricTile label="Avg hours (worked days)" value={metrics.attendance?.avg_hours_on_worked_days} />
              <MetricTile
                label="Tasks done"
                value={metrics.tasks ? `${metrics.tasks.done} of ${metrics.tasks.assigned}` : undefined}
              />
              <MetricTile label="Tasks done %" value={pct(metrics.tasks?.done_pct)} />
              <MetricTile label="Quizzes taken" value={metrics.quizzes?.taken} />
              <MetricTile label="Quiz average" value={pct(metrics.quizzes?.avg_score_pct)} />
              <MetricTile label="Code reviews published" value={metrics.code_reviews_published} />
              <MetricTile label="Stall alerts" value={metrics.stall_alerts} />
              <MetricTile label="Composite score" value={pct(metrics.composite_score_pct)} />
            </dl>
            {metrics.composite_note && <p className="mt-2 text-xs text-muted">{metrics.composite_note}</p>}
            {metrics.skills && metrics.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {metrics.skills.map((s) => (
                  <Badge key={s.skill} tone={s.level === null ? "neutral" : "primary"}>
                    {s.skill} · {s.level === null ? "Insufficient data" : `L${s.level} · ${s.score_pct}%`}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">No metrics were attached to this draft.</p>
        )}
      </section>
      <div>
        <Label htmlFor="ap-summary">Qualitative summary</Label>
        <Textarea
          id="ap-summary"
          value={value.qualitative_summary}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => set("qualitative_summary", e.target.value)}
        />
      </div>
      <StringListEditor label="Strengths" items={value.strengths} max={6} disabled={disabled} onChange={(v) => set("strengths", v)} />
      <StringListEditor
        label="Growth areas"
        max={6}
        items={value.growth_areas}
        disabled={disabled}
        onChange={(v) => set("growth_areas", v)}
      />
      <StringListEditor label="Next goals" items={value.next_goals} max={6} disabled={disabled} onChange={(v) => set("next_goals", v)} />
      <div>
        <Label htmlFor="ap-brief">Mentor brief</Label>
        <Textarea
          id="ap-brief"
          value={value.mentor_brief}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => set("mentor_brief", e.target.value)}
        />
      </div>
      <fieldset className="space-y-3 rounded-lg border border-border bg-surface p-3">
        <legend className="px-1 text-xs font-medium text-muted">Self-appraisal scaffold for the intern</legend>
        <StringListEditor
          label="Accomplishments"
          max={6}
          items={value.self_appraisal_scaffold.accomplishments}
          disabled={disabled}
          onChange={(v) => setScaffold("accomplishments", v)}
        />
        <StringListEditor
          label="Challenges"
          max={6}
          items={value.self_appraisal_scaffold.challenges}
          disabled={disabled}
          onChange={(v) => setScaffold("challenges", v)}
        />
        <StringListEditor
          label="Focus goals"
          max={6}
          items={value.self_appraisal_scaffold.focus_goals}
          disabled={disabled}
          onChange={(v) => setScaffold("focus_goals", v)}
        />
      </fieldset>
    </div>
  );
}
