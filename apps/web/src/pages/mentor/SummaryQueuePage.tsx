import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { QueueRow, SummaryStatus } from "@/features/evaluation/types";
import { api } from "@/lib/api";

export const summaryBadge: Record<SummaryStatus, ReactElement> = {
  draft: <Badge tone="ai">AI draft</Badge>,
  changes_requested: <Badge tone="warning">Redrafting</Badge>,
  approved: <Badge tone="success">Approved</Badge>,
  published: <Badge tone="primary">Published</Badge>,
};

export function SummaryQueuePage() {
  const { examId } = useParams();
  usePageTitle("Evaluation summaries");
  const q = useQuery({ queryKey: ["summary-queue", examId], queryFn: () => api<QueueRow[]>(`/evaluation-summaries?exam_id=${examId}`) });
  return (
    <div className="space-y-4">
      <Link to={`/mentor/exams/${examId}`} className="text-sm text-primary-700 hover:underline">
        ← Back to assessment
      </Link>
      <p className="text-sm text-text">AI drafts appear here after scoring. Nothing reaches a candidate until you approve and publish it.</p>
      <QueryState query={q} isEmpty={(d) => d.length === 0} emptyMessage="No scored attempts yet.">
        {(rows) => (
          <Table>
            <THead>
              <tr>
                <TH>Candidate</TH>
                <TH>Summary</TH>
                <TH>Version</TH>
                <TH>Updated</TH>
                <TH><span className="sr-only">Open</span></TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.session_id}>
                  <TD className="font-medium">{r.candidate_name}</TD>
                  <TD>{r.status ? summaryBadge[r.status] : <Badge>Not drafted</Badge>}</TD>
                  <TD>{r.version ?? "–"}</TD>
                  <TD className="text-muted">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "–"}</TD>
                  <TD>
                    <Link className="text-sm text-primary-700 hover:underline" to={`/mentor/sessions/${r.session_id}/summary`}>
                      {r.status === "draft" && r.ready_for_review ? "Review" : "Open"}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryState>
    </div>
  );
}
