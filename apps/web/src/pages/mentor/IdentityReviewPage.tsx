import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { ErrorState, QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { authStore } from "@/features/auth/store";
import { API_BASE, api, errorMessage } from "@/lib/api";

interface Review {
  check_id: string;
  session_id: string;
  exam_title: string;
  candidate_name: string;
  kind: "start" | "random";
  attempt: number;
  liveness_ok: boolean | null;
  liveness_detail: string | null;
  similarity: number | null;
  result: string;
  created_at: string;
  has_crop: boolean;
}

/** Crop images need the bearer token, so fetch them as blobs instead of using a plain <img src>. */
function CropImage({ checkId, name }: { checkId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    fetch(`${API_BASE}/mentor/identity-checks/${checkId}/crop`, {
      headers: { Authorization: `Bearer ${authStore.get()?.access_token ?? ""}` },
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("unavailable"))))
      .then((b) => setUrl((revoked = URL.createObjectURL(b))))
      .catch(() => setFailed(true));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [checkId]);
  if (failed)
    return (
      <div className="flex size-32 items-center justify-center rounded-xl bg-surface-muted px-2 text-center text-xs text-muted">
        Image unavailable
      </div>
    );
  return url ? (
    <img src={url} alt={`Face crop captured for ${name}`} className="size-32 rounded-xl border border-border object-cover" />
  ) : (
    <div className="size-32 rounded-xl bg-surface-muted" aria-hidden="true" />
  );
}

function ReviewCard({ r }: { r: Review }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const decide = useMutation({
    mutationFn: (decision: "allow" | "block") =>
      api(`/mentor/identity-checks/${r.check_id}/decision`, { body: { decision, comment } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-reviews"] }),
  });
  return (
    <Card className="flex flex-wrap gap-5">
      {r.has_crop && <CropImage checkId={r.check_id} name={r.candidate_name} />}
      <div className="min-w-64 flex-1 space-y-3">
        <div>
          <CardTitle>{r.candidate_name}</CardTitle>
          <CardDescription>
            {r.exam_title} · {r.kind === "start" ? `start check, attempt ${r.attempt}` : "random check during the assessment"} ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.liveness_ok === null ? null : r.liveness_ok ? (
            <Badge tone="success">Liveness passed</Badge>
          ) : (
            <Badge tone="danger">Liveness not passed</Badge>
          )}
          {r.similarity !== null && <Badge tone="info">Similarity {r.similarity.toFixed(2)}</Badge>}
          {r.liveness_detail && <Badge>{r.liveness_detail}</Badge>}
        </div>
        {r.kind === "random" && (
          <p className="text-xs text-muted">This candidate continued the assessment. Your decision is recorded on their timeline only.</p>
        )}
        <div>
          <Label htmlFor={`c-${r.check_id}`}>Comment (optional)</Label>
          <Input id={`c-${r.check_id}`} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => decide.mutate("block")} disabled={decide.isPending}>
            {r.kind === "start" ? "Do not allow start" : "Note concern"}
          </Button>
          <Button onClick={() => decide.mutate("allow")} disabled={decide.isPending}>
            {r.kind === "start" ? "Allow start" : "Looks fine"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function IdentityReviewPage() {
  usePageTitle("Identity reviews");
  const q = useQuery({
    queryKey: ["identity-reviews"],
    queryFn: () => api<Review[]>("/mentor/identity-reviews"),
    refetchInterval: 10_000,
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-text">
        Checks that failed or were uncertain wait here. Candidates at the start wait for your decision; nobody is blocked
        automatically.
      </p>
      <QueryState query={q} isEmpty={(d) => d.length === 0} emptyMessage="No identity checks need review.">
        {(list) => (
          <div className="space-y-4">
            {list.map((r) => (
              <ReviewCard key={r.check_id} r={r} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
