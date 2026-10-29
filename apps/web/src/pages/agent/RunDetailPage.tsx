import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Cpu, Sparkles, Wrench } from "lucide-react";
import { useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { StatCard } from "@/components/StatCard";
import { QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AgentBadge, type RunRow, RunStatus } from "./AgentDashboardPage";

interface Step {
  seq: number;
  kind: "llm" | "tool" | "deterministic";
  tool: string | null;
  args: Record<string, unknown> | null;
  output_summary: string | null;
  reason: string | null;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  error: string | null;
  at: string;
  title: string;
  detail: string | null;
  facts: { label: string; value: string }[];
}

interface RunDetail extends RunRow {
  inputs: Record<string, unknown>;
  data_timestamps: Record<string, string | null>;
  steps: Step[];
  decision: {
    kind: "summary" | "questions";
    status?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    edited_by_mentor?: boolean | null;
    version?: number | null;
    accepted?: number | null;
    skipped?: number | null;
    pending?: number | null;
  } | null;
}

const kindLabel = { llm: "Model call", tool: "Tool call", deterministic: "Deterministic step" };

function StepIcon({ s }: { s: Step }) {
  const cls = "absolute -left-[33px] top-3 flex size-5 items-center justify-center rounded-full border-2 border-bg";
  if (s.error) return <span className={cn(cls, "bg-danger-50 text-danger-700")}><AlertCircle className="size-3.5" aria-hidden="true" /></span>;
  if (s.kind === "llm") return <span className={cn(cls, "bg-ai-100 text-ai-700")}><Sparkles className="size-3" aria-hidden="true" /></span>;
  if (s.kind === "deterministic") return <span className={cn(cls, "bg-surface-muted text-muted")}><Cpu className="size-3" aria-hidden="true" /></span>;
  return <span className={cn(cls, "bg-primary-50 text-primary-700")}><Wrench className="size-3" aria-hidden="true" /></span>;
}

function StepItem({ s }: { s: Step }) {
  const meta = `${s.latency_ms} ms${s.tokens_in || s.tokens_out ? ` · ${s.tokens_in} tokens in / ${s.tokens_out} out` : ""}`;
  if (s.kind === "llm") {
    return (
      <li className="relative py-1">
        <StepIcon s={s} />
        <p className="text-sm text-muted">
          <span className="font-medium text-ai-700">Step {s.seq} · {s.title ?? "Model call"}</span>
          <span className="ml-2 text-xs">{meta}</span>
        </p>
        {s.detail && <p className="mt-1 text-sm text-text">{s.detail}</p>}
      </li>
    );
  }
  return (
    <li className="relative rounded-xl border border-border bg-surface p-4">
      <StepIcon s={s} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Step {s.seq}</span>
        <Badge tone={s.kind === "deterministic" ? "neutral" : "primary"}>{kindLabel[s.kind]}</Badge>
        {s.error && <Badge tone="danger">Rejected</Badge>}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-text">{s.title ?? s.tool}</h3>
      {s.detail && (
        <p className={cn("mt-1 text-sm", s.error ? "rounded-lg bg-danger-50 px-3 py-2 text-danger-700" : "text-text")}>{s.detail}</p>
      )}
      {(s.facts ?? []).length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-2">
          {(s.facts ?? []).map((f) => (
            <div key={f.label} className="rounded-lg bg-surface-muted px-2.5 py-1 text-xs">
              <dt className="inline text-muted">{f.label}: </dt>
              <dd className="inline text-text">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted">{meta}</p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-primary-700">Technical details</summary>
        <div className="mt-2 space-y-2">
          <p className="font-mono text-muted">tool: {s.tool}</p>
          {s.args && Object.keys(s.args).length > 0 && (
            <pre className="max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-text">{JSON.stringify(s.args, null, 2)}</pre>
          )}
          {s.output_summary && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-muted p-3 text-text">{s.output_summary}</pre>}
        </div>
      </details>
    </li>
  );
}

function DecisionText({ d }: { d: NonNullable<RunDetail["decision"]> }) {
  if (d.kind === "questions")
    return <>{d.accepted} accepted · {d.skipped} skipped · {d.pending} awaiting decision</>;
  return (
    <>
      Summary {d.status?.replace(/_/g, " ")} (version {d.version})
      {d.approved_by && <> · approved by {d.approved_by}{d.approved_at && ` on ${new Date(d.approved_at).toLocaleString()}`}</>}
      {d.edited_by_mentor !== null && d.edited_by_mentor !== undefined && <> · {d.edited_by_mentor ? "edited by mentor" : "no mentor edits"}</>}
    </>
  );
}

export function RunDetailPage() {
  const { runId } = useParams();
  usePageTitle("Agent run");
  const q = useQuery({ queryKey: ["agent-run", runId], queryFn: () => api<RunDetail>(`/agent/runs/${runId}`) });
  return (
    <QueryState query={q} emptyMessage="">
      {(r) => (
        <div className="space-y-6">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AgentBadge agent={r.agent} />
              <RunStatus status={r.status} />
            </div>
            <CardTitle>{r.goal}</CardTitle>
            <CardDescription>
              Model {r.model ?? "–"} · prompt {r.prompt_version ?? "–"} · started {new Date(r.started_at).toLocaleString()}
            </CardDescription>
            {r.error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{r.error}</p>}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(r.inputs).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">Input · {k}</dt>
                  <dd className="break-all font-mono text-xs text-text">{String(v)}</dd>
                </div>
              ))}
              {Object.entries(r.data_timestamps).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">Data · {k.replace(/_/g, " ")}</dt>
                  <dd className="text-text">{v ? new Date(v).toLocaleString() : "–"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Duration" value={r.duration_ms === null ? "–" : `${(r.duration_ms / 1000).toFixed(1)} s`} />
            <StatCard label="Tokens in" value={r.tokens_in.toLocaleString()} />
            <StatCard label="Tokens out" value={r.tokens_out.toLocaleString()} />
            <StatCard label="Estimated cost" value={`$${r.cost_usd.toFixed(4)}`} />
          </div>
          {r.decision && (
            <Card>
              <CardTitle className="mb-1">Final mentor decision</CardTitle>
              <p className="text-sm text-text"><DecisionText d={r.decision} /></p>
            </Card>
          )}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Steps</h2>
            <p className="text-xs text-muted">
              What the agent did, in order. Notes are the model's visible messages only; internal reasoning is never stored or
              shown.
            </p>
            {r.steps.length === 0 && <p className="text-sm text-muted">No steps recorded.</p>}
            <ol className="relative space-y-3 border-l border-border pl-6">
              {r.steps.map((s) => (
                <StepItem key={s.seq} s={s} />
              ))}
            </ol>
          </section>
        </div>
      )}
    </QueryState>
  );
}
