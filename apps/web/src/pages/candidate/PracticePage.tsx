import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CheckCircle2,
  CircleX,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import { mockPracticeSetData } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface PracticeQuestion {
  id: string;
  body: string;
  options: { key: string; text: string }[];
  explanation?: string;
}

interface Practice {
  id: string;
  exam_title: string;
  topic?: string;
  questions: PracticeQuestion[];
}

interface PracticeResult {
  score_pct: number;
  correct: Record<string, boolean>;
  correct_keys: Record<string, string>;
}

const TOPICS = [
  {
    id: "full-stack",
    title: "Full Stack Development",
    status: "Developing",
    tone: "warning" as const,
    description: "SSR hydration, Server Actions, route handlers, and end-to-end full stack architecture.",
  },
  {
    id: "frontend",
    title: "Frontend Engineering",
    status: "Strong",
    tone: "success" as const,
    description: "Modern React Hooks, TypeScript interfaces, Tailwind styling, and Web Vitals optimization.",
  },
  {
    id: "backend",
    title: "Backend & Databases",
    status: "Weak",
    tone: "danger" as const,
    description: "REST/gRPC APIs, PostgreSQL transaction isolation, Redis caching, and JWT auth.",
  },
  {
    id: "data-analyst",
    title: "Data Analytics & SQL",
    status: "Strong",
    tone: "success" as const,
    description: "Window functions, CTEs, aggregation pipelines, and statistical modeling in Pandas.",
  },
  {
    id: "ai-engineer",
    title: "AI Engineering & LLMs",
    status: "Developing",
    tone: "warning" as const,
    description: "RAG vector retrieval, prompt chaining, function calling, and agentic workflows.",
  },
];

export function PracticePage() {
  const { practiceId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const queryTopic = searchParams.get("topic");

  usePageTitle("Targeted Practice");

  const [selectedTopic, setSelectedTopic] = useState<string>(() => {
    if (paramId) return paramId;
    if (queryTopic) {
      const match = TOPICS.find((t) => t.title.toLowerCase().includes(queryTopic.toLowerCase()) || queryTopic.toLowerCase().includes(t.id));
      if (match) return match.id;
    }
    return "full-stack";
  });
  const effectivePracticeId = selectedTopic || "ps-1";

  const practiceQuery = useQuery({
    queryKey: ["practice", effectivePracticeId],
    queryFn: () => api<Practice>(`/practice-sets/${effectivePracticeId}`),
  });

  const practiceData = practiceQuery.data ?? mockPracticeSetData;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<PracticeResult | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      api<PracticeResult>(`/practice-sets/${effectivePracticeId}/submit`, {
        body: { answers },
      }),
    onSuccess: (data) => {
      setSubmissionResult(data);
    },
  });

  const handleReset = () => {
    setAnswers({});
    setSubmissionResult(null);
  };

  const handleTopicChange = (topicId: string) => {
    setSelectedTopic(topicId);
    setAnswers({});
    setSubmissionResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text">Targeted Concept Practice</h2>
        <p className="text-xs text-muted">
          Strengthen foundational knowledge with instant pedagogical explanations. This practice does not affect your graded assessment score.
        </p>
      </div>

      {/* Mentor Closed-Loop Notice if redirected from Results */}
      {queryTopic && (
        <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 p-4 text-xs text-primary-900 animate-in fade-in">
          <Sparkles className="size-4 text-primary-600 shrink-0" />
          <span>
            <strong>Closed-Loop Practice Set:</strong> Priya Sharma approved this targeted practice module to help reinforce concept mastery in <strong>"{queryTopic}"</strong> following your recent assessment.
          </span>
        </div>
      )}

      {/* Topic Switcher Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TOPICS.map((t) => {
          const isSelected = selectedTopic === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTopicChange(t.id)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all",
                isSelected
                  ? "border-primary-500 bg-primary-50/60 shadow-xs"
                  : "border-border bg-surface hover:border-primary-200 hover:bg-surface-muted/50",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-semibold text-xs text-text">{t.title}</span>
                <Badge tone={t.tone}>{t.status}</Badge>
              </div>
              <p className="text-[11px] text-muted line-clamp-2">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Questions Card */}
      {practiceQuery.isPending && !practiceData ? (
        <LoadingState label="Loading practice questions..." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary-600" />
              <span className="font-semibold text-sm text-text">
                {practiceData.exam_title ?? "Concept Practice"} · {practiceData.questions.length} Questions
              </span>
            </div>

            {submissionResult && (
              <Button size="sm" variant="secondary" onClick={handleReset} className="gap-1.5 text-xs">
                <RotateCcw className="size-3.5" />
                <span>Retry Quiz</span>
              </Button>
            )}
          </div>

          {practiceData.questions.map((q, idx) => {
            const isSubmitted = Boolean(submissionResult);
            const isCorrect = submissionResult?.correct[q.id];
            const correctKey = submissionResult?.correct_keys[q.id];

            return (
              <Card key={q.id} className="space-y-4 p-5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="flex items-start gap-2.5 text-sm font-semibold text-text">
                    <span className="font-mono text-primary-700">Q{idx + 1}.</span>
                    <span>{q.body}</span>
                  </h3>

                  {isSubmitted && (
                    <div>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
                          <CheckCircle2 className="size-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">
                          <CircleX className="size-3.5" /> Review Concept
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Options Radio List */}
                <fieldset className="space-y-2.5" disabled={isSubmitted}>
                  <legend className="sr-only">Choose one answer</legend>
                  {q.options.map((opt) => {
                    const isSelected = answers[q.id] === opt.key;
                    const isTheCorrectAnswer = isSubmitted && correctKey === opt.key;
                    const isChosenWrong = isSubmitted && isSelected && !isCorrect;

                    return (
                      <label
                        key={opt.key}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors",
                          isSelected ? "border-primary-500 bg-primary-50 font-medium text-text" : "border-border bg-surface text-text hover:bg-surface-muted/50",
                          isTheCorrectAnswer && "border-success-500 bg-success-50 font-semibold text-success-900",
                          isChosenWrong && "border-danger-400 bg-danger-50 text-danger-900",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.key}
                            checked={isSelected}
                            onChange={() => setAnswers({ ...answers, [q.id]: opt.key })}
                            className="size-4 accent-primary-600"
                          />
                          <span className="font-mono font-bold text-muted">{opt.key}.</span>
                          <span>{opt.text}</span>
                        </div>

                        {isTheCorrectAnswer && (
                          <span className="text-[11px] font-semibold text-success-700">
                            Correct Answer
                          </span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>

                {/* Explanation shown after submission */}
                {isSubmitted && q.explanation && (
                  <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-3 text-xs space-y-1">
                    <span className="flex items-center gap-1.5 font-semibold text-primary-800">
                      <Sparkles className="size-3.5" /> Pedagogical Explanation:
                    </span>
                    <p className="text-muted leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </Card>
            );
          })}

          {submitMutation.isError && <ErrorState message={errorMessage(submitMutation.error)} />}

          {/* Submission Bar */}
          {submissionResult ? (
            <Card className="flex flex-col justify-between gap-4 border-border p-5 shadow-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-800">
                  <Award className="size-6" />
                </div>
                <div>
                  <div className="font-bold text-sm text-text">Practice Completed!</div>
                  <div className="text-xs text-muted">
                    Your Score: <span className="font-extrabold text-success-700">{submissionResult.score_pct}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleReset}>
                  Practice Again
                </Button>
                <Button asChild className="bg-primary-600 text-white hover:bg-primary-700">
                  <Link to="/candidate">Back to Dashboard</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                {Object.keys(answers).length} of {practiceData.questions.length} answered
              </span>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || Object.keys(answers).length === 0}
                className="bg-primary-600 font-medium text-white shadow-xs hover:bg-primary-700"
              >
                {submitMutation.isPending ? "Evaluating..." : "Check my answers"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
