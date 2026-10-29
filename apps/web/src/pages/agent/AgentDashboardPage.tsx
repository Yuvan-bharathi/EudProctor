import {
  CheckCircle2,
  Filter,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { type AgentRunRow, getPersistedAgentRuns } from "@/lib/mockData";

export interface RunRow {
  id: string;
  agent: string;
  status: "running" | "succeeded" | "failed";
  goal: string;
  model: string | null;
  prompt_version: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number | null;
  started_at: string;
  error: string | null;
}

export function AgentBadge({ agent }: { agent: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-ai-50 px-2 py-0.5 text-xs font-medium text-ai-700">
      <Sparkles className="size-3" />
      {agent}
    </span>
  );
}

export function RunStatus({ status }: { status: RunRow["status"] }) {
  if (status === "succeeded") return <Badge tone="success">Succeeded</Badge>;
  if (status === "failed") return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="info">Running</Badge>;
}

type RunFilter = "all" | "draft" | "errors";

export function AgentDashboardPage() {
  usePageTitle("Agent Runs · Admin & Mentor Observability");

  const [activeTab, setActiveTab] = useState<RunFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedRun, setSelectedRun] = useState<AgentRunRow | null>(null);

  const [runsList, setRunsList] = useState<AgentRunRow[]>(getPersistedAgentRuns);

  useEffect(() => {
    const handleUpdate = () => {
      setRunsList(getPersistedAgentRuns());
    };
    window.addEventListener("eduproctor_agent_runs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("eduproctor_agent_runs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredRuns = runsList.filter((r) => {
    const matchesSearch =
      r.assessment.toLowerCase().includes(search.toLowerCase()) || r.agent.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "all"
        ? true
        : activeTab === "draft"
          ? r.status === "Completed"
          : r.status === "Failed";
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      {/* Top Header matching Screen 12 */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">Agent Runs</h2>
          <p className="text-xs text-muted">Visibility into AI agent runs, status and summaries.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-ai-50 px-3 py-1 text-xs font-semibold text-ai-700">
            <Sparkles className="size-3.5 text-ai-500" />
            <span>Claude 3.5 Sonnet Tool-Use Loop</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs matching Screen 12:
          All runs, Draft summaries (2), Errors */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "All runs", count: runsList.length },
          { key: "draft", label: "Draft summaries", count: 2 },
          { key: "errors", label: "Errors", count: runsList.filter((r) => r.status === "Failed").length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as RunFilter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary-50 text-primary-700 shadow-2xs"
                : "text-muted hover:bg-surface-muted hover:text-text"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search & Actions Bar matching Screen 12 */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search runs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs text-muted hover:text-text">
            <Filter className="size-3.5" />
            <span>Filters</span>
          </Button>
        </div>
      </div>

      {/* Agent Runs Table matching Screen 12 */}
      <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Assessment</TH>
              <TH>Run time</TH>
              <TH>Agent Name</TH>
              <TH>Status</TH>
              <TH>Tokens (In / Out)</TH>
              <TH>Cost (USD)</TH>
              <TH className="text-right">Summary</TH>
            </tr>
          </THead>
          <TBody>
            {filteredRuns.map((run) => (
              <TR key={run.id} className="transition-colors hover:bg-surface-muted/50">
                <TD>
                  <span className="font-semibold text-xs text-text">{run.assessment}</span>
                </TD>

                <TD className="text-xs text-muted font-mono">{run.runTime}</TD>

                <TD>
                  <span className="inline-flex items-center gap-1 rounded bg-ai-50 px-2 py-0.5 text-xs font-medium text-ai-700">
                    <Sparkles className="size-3" />
                    {run.agent}
                  </span>
                </TD>

                <TD>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      run.status === "Completed"
                        ? "bg-success-50 text-success-700"
                        : run.status === "Failed"
                          ? "bg-danger-50 text-danger-700"
                          : "bg-info-50 text-info-700"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        run.status === "Completed"
                          ? "bg-success-500"
                          : run.status === "Failed"
                            ? "bg-danger-500"
                            : "bg-info-500 animate-pulse"
                      }`}
                    />
                    {run.status}
                  </span>
                </TD>

                <TD className="text-xs font-mono text-muted">
                  {run.tokensIn} / {run.tokensOut}
                </TD>

                <TD className="text-xs font-mono text-text">${run.costUsd.toFixed(4)}</TD>

                {/* Drill-down "View" button matching Screen 12 */}
                <TD className="text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedRun(run)}
                    className="h-7 text-xs font-semibold text-primary-700"
                  >
                    View
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Drill-down Modal with Execution Trace */}
      {selectedRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-text">Agent Run Observability Trace</h4>
                <p className="text-xs text-muted">Run ID: {selectedRun.id} · {selectedRun.assessment}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="rounded p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg bg-surface-muted p-3 space-y-1.5">
                <div className="font-semibold text-text">Run Summary</div>
                <p className="text-muted leading-relaxed">{selectedRun.summaryTitle}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <span className="text-[10px] text-muted uppercase">Latency</span>
                  <div className="font-mono text-sm font-bold text-text">{selectedRun.latencyMs} ms</div>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <span className="text-[10px] text-muted uppercase">Tool Calls</span>
                  <div className="font-mono text-sm font-bold text-text">{selectedRun.toolCalls} calls</div>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <span className="text-[10px] text-muted uppercase">Cost (USD)</span>
                  <div className="font-mono text-sm font-bold text-primary-700">${selectedRun.costUsd.toFixed(4)}</div>
                </div>
              </div>

              {/* Tool Execution Sequence */}
              <div className="space-y-2 border-t border-border pt-3">
                <span className="font-semibold text-text">Allow-listed Tool Calls</span>
                <ol className="space-y-1.5 font-mono text-[11px] text-muted">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-success-600" />
                    <span>get_candidate_performance(session_id="{selectedRun.id}")</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-success-600" />
                    <span>query_notes_library(topic="First Law", level="Core")</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-success-600" />
                    <span>draft_evaluation_summary(status="pending_mentor_approval")</span>
                  </li>
                </ol>
              </div>

              <div className="rounded-lg bg-ai-50 p-3 text-ai-700 text-[11px] leading-tight">
                <strong>Mandatory Guardrail Checked:</strong> Agent has zero publish permission and cannot modify marks
                or delete proctoring telemetry. Every draft is locked until a human mentor approves.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedRun(null)}>
                Close Trace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
