import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";

interface JoinResult {
  assignment_id: string;
  exam_id: string;
  exam_title: string;
  duration_min: number;
  session_id: string | null;
}

/** Redeems the single-use link once, then hands over to the session flow. */
export function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const join = useMutation({
    mutationFn: () => api<JoinResult>(`/join/${token}`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.session_id) navigate(`/candidate/sessions/${r.session_id}`, { replace: true });
    },
  });
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      join.mutate();
    }
  }, [join]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">Opening your assessment</h1>
        {join.isPending && <LoadingState rows={2} label="Checking your link" />}
        {join.isError && (
          <>
            <ErrorState message={errorMessage(join.error)} />
            <Button variant="secondary" onClick={() => navigate("/candidate")}>
              Go to my home page
            </Button>
          </>
        )}
        {join.isSuccess && !join.data.session_id && (
          <>
            <p className="text-sm text-text">
              Link accepted for <strong>{join.data.exam_title}</strong>. Continue from your home page.
            </p>
            <Button variant="secondary" onClick={() => navigate("/candidate")}>
              Go to my home page
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
