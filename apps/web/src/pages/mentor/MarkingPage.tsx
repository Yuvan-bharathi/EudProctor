import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { ErrorState, QueryState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";

interface MarkingItem {
  answer_id: string;
  candidate_name: string;
  question: string;
  model_answer: string | null;
  max_marks: number;
  text: string;
}

function MarkCard({ item, examId }: { item: MarkingItem; examId: string }) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState("");
  const [comment, setComment] = useState("");
  const save = useMutation({
    mutationFn: () => api(`/mentor/answers/${item.answer_id}/mark`, { body: { marks: Number(marks), comment: comment || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marking", examId] });
      qc.invalidateQueries({ queryKey: ["results", examId] });
    },
  });
  const valid = marks !== "" && Number(marks) >= 0 && Number(marks) <= item.max_marks;
  return (
    <Card className="space-y-3">
      <div>
        <CardTitle>{item.question}</CardTitle>
        <CardDescription>
          {item.candidate_name} · up to {item.max_marks} mark(s)
        </CardDescription>
      </div>
      {item.model_answer && (
        <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-text">
          <span className="font-medium">Model answer: </span>
          {item.model_answer}
        </div>
      )}
      <p className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm text-text">{item.text}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="w-28">
          <Label htmlFor={`m-${item.answer_id}`}>Marks</Label>
          <Input id={`m-${item.answer_id}`} type="number" min={0} max={item.max_marks} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} />
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor={`c-${item.answer_id}`}>Comment (optional)</Label>
          <Input id={`c-${item.answer_id}`} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={!valid || save.isPending}>
          Save mark
        </Button>
      </form>
      {save.isError && <ErrorState message={errorMessage(save.error)} />}
    </Card>
  );
}

export function MarkingPage() {
  const { examId = "" } = useParams();
  usePageTitle("Marking queue");
  const q = useQuery({ queryKey: ["marking", examId], queryFn: () => api<MarkingItem[]>(`/exams/${examId}/marking-queue`) });
  return (
    <div className="space-y-4">
      <Link to={`/mentor/exams/${examId}/results`} className="text-sm text-primary-700 hover:underline">
        ← Back to results
      </Link>
      <QueryState query={q} isEmpty={(d) => d.length === 0} emptyMessage="Nothing to mark. All written answers are marked.">
        {(list) => (
          <div className="space-y-4">
            {list.map((i) => (
              <MarkCard key={i.answer_id} item={i} examId={examId} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
