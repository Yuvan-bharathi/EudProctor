import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssessmentView } from "@/features/assessment/AssessmentView";
import type { CandidateSession } from "@/features/assessment/types";
import { PreStartFlow } from "@/features/identity/PreStartFlow";
import { ProctoringLayer } from "@/features/proctoring/ProctoringLayer";
import { api } from "@/lib/api";

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-lg space-y-4 p-6">{children}</Card>
    </main>
  );
}

export function SessionPage() {
  const { sessionId } = useParams();
  const qc = useQueryClient();
  const key = ["session", sessionId];
  const q = useQuery({ queryKey: key, queryFn: () => api<CandidateSession>(`/sessions/${sessionId}`) });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["session", sessionId] }), [qc, sessionId]);

  if (q.isPending) return <Centered><LoadingState label="Loading assessment" /></Centered>;
  if (q.isError) return <Centered><ErrorState message="Could not load this assessment." onRetry={() => q.refetch()} /></Centered>;
  const s = q.data;

  if (s.status === "in_progress") {
    return (
      <AssessmentView session={s} onSubmitted={refresh} onExpired={refresh} flagSlot={<ProctoringLayer session={s} />} />
    );
  }
  if (s.status === "submitted" || s.status === "scored" || s.status === "analysed") {
    return (
      <Centered>
        <CheckCircle2 className="size-8 text-success-700" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Assessment submitted</h1>
        <p className="text-sm text-text">
          Thank you. Your answers for <strong>{s.exam_title}</strong> are saved. Your mentor will publish results and
          recommendations on your dashboard.
        </p>
        <Button asChild variant="secondary">
          <Link to="/candidate">Back to my dashboard</Link>
        </Button>
      </Centered>
    );
  }
  if (s.status === "expired") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">This assessment window has closed</h1>
        <p className="text-sm text-text">Please contact your mentor if you think this is a mistake.</p>
      </Centered>
    );
  }
  if (s.status === "identity_blocked") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Your mentor needs to speak with you</h1>
        <p className="text-sm text-text">
          Your mentor reviewed the identity check and could not confirm it. Please contact them to arrange another attempt.
        </p>
      </Centered>
    );
  }
  return <PreStartFlow session={s} onChange={refresh} />;
}
