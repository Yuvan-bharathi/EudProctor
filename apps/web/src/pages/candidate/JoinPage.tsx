import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authStore, type User } from "@/features/auth/store";
import { api, errorMessage } from "@/lib/api";

interface JoinResult {
  assignment_id: string;
  exam_id: string;
  exam_title: string;
  duration_min: number;
  session_id: string | null;
  access_token?: string;
  refresh_token?: string;
  user?: User;
}

/** Redeems the single-use link once, then hands over to the session flow. */
export function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const join = useMutation({
    mutationFn: () => api<JoinResult>(`/join/${token}`, { method: "POST" }),
    onSuccess: (r) => {
      // Seamlessly switch session to candidate authenticated by this link
      if (r.access_token && r.refresh_token && r.user) {
        authStore.set({
          access_token: r.access_token,
          refresh_token: r.refresh_token,
          user: r.user,
        });
      }
      if (r.session_id) {
        navigate(`/candidate/sessions/${r.session_id}`, { replace: true });
      }
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
          <div className="space-y-4">
            <ErrorState message={errorMessage(join.error)} />
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-text-muted">
              <p className="font-semibold text-text">Testing Tips:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>If your browser is currently logged in as a <strong>Mentor</strong>, open this link in a <strong>New Incognito / Private Window</strong> to test as Candidate.</li>
                <li>If this link was already used or expired, click <strong>Resend</strong> in the Mentor Workspace to get a fresh single-use link.</li>
              </ul>
            </div>
            <Button variant="secondary" onClick={() => navigate("/candidate")}>
              Go to candidate home
            </Button>
          </div>
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
