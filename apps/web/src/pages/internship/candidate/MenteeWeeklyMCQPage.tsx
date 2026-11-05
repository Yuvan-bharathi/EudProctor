import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  FileQuestion,
  Lightbulb,
  Play,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { internshipApi, type WeeklyQuiz } from "@/lib/internshipApi";

type View = { mode: "list" } | { mode: "take"; id: string } | { mode: "results"; id: string; justSubmitted?: boolean };

const quizKey = (id: string) => ["internship", "quiz", id] as const;

function formatTimer(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

// ------------------------------------------------------------------ list

function QuizCard({ quiz, onOpen }: { quiz: WeeklyQuiz; onOpen: () => void }) {
  const isSubmitted = quiz.status === "submitted";
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <Badge tone="neutral">
            Month {quiz.month_number} · Week {quiz.week_number}
          </Badge>
          {isSubmitted ? (
            <Badge tone="success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Submitted{quiz.score_pct != null && ` · ${quiz.score_pct}%`}
            </Badge>
          ) : (
            <Badge tone="info">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Ready to start
            </Badge>
          )}
        </div>
        <h3 className="mt-3 text-sm font-semibold leading-snug text-text">{quiz.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <FileQuestion className="size-3.5" aria-hidden="true" />
            {quiz.question_count} questions
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden="true" />
            {quiz.duration_min} min
          </span>
        </div>
        {isSubmitted && quiz.submitted_at && (
          <p className="mt-2 text-xs text-muted">Submitted {formatDate(quiz.submitted_at)}</p>
        )}
      </div>
      <div className="mt-4 border-t border-border pt-3">
        {isSubmitted ? (
          <Button variant="secondary" className="w-full" onClick={onOpen}>
            <Award aria-hidden="true" />
            View results
          </Button>
        ) : (
          <Button className="w-full" onClick={onOpen}>
            <Play aria-hidden="true" />
            Start weekly check
          </Button>
        )}
      </div>
    </Card>
  );
}

function QuizList({ onOpen }: { onOpen: (q: WeeklyQuiz) => void }) {
  const quizzesQ = useQuery({ queryKey: ["internship", "quizzes"], queryFn: () => internshipApi.quizzes() });
  const [month, setMonth] = useState<number | "all">("all");

  if (quizzesQ.isPending) return <LoadingState rows={4} label="Loading weekly checks" />;
  if (quizzesQ.isError)
    return <ErrorState message={errorMessage(quizzesQ.error)} onRetry={() => quizzesQ.refetch()} />;

  const quizzes = quizzesQ.data;
  if (quizzes.length === 0)
    return (
      <EmptyState message="No weekly check yet. Your weekly check appears here after your mentor approves it — usually on Fridays." />
    );

  const available = quizzes.filter((q) => q.status === "available");
  const submitted = quizzes.filter((q) => q.status === "submitted");
  const latestSubmitted = submitted.reduce<WeeklyQuiz | null>(
    (acc, q) => (!acc || q.week_number > acc.week_number ? q : acc),
    null,
  );
  const months = Array.from(new Set(quizzes.map((q) => q.month_number))).sort((a, b) => a - b);
  const shown = month === "all" ? quizzes : quizzes.filter((q) => q.month_number === month);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="text-xs font-medium text-muted">Ready to take</span>
          <p className="mt-1 text-xl font-bold text-text">{available.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="text-xs font-medium text-muted">Completed</span>
          <p className="mt-1 text-xl font-bold text-text">{submitted.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="text-xs font-medium text-muted">Latest score</span>
          <p className="mt-1 text-xl font-bold text-text">
            {latestSubmitted?.score_pct != null ? `${latestSubmitted.score_pct}%` : "—"}
          </p>
          {latestSubmitted && <span className="text-xs text-muted">Week {latestSubmitted.week_number}</span>}
        </div>
      </div>

      {months.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Month">
            {(["all", ...months] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={month === m}
                onClick={() => setMonth(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                  month === m ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {m === "all" ? "All weeks" : `Month ${m}`}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">
            Showing <strong>{shown.length}</strong> weekly checks
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((q) => (
          <QuizCard key={q.id} quiz={q} onOpen={() => onOpen(q)} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ taking

function TakeQuiz({ id, onExit, onSubmitted }: { id: string; onExit: () => void; onSubmitted: (q: WeeklyQuiz) => void }) {
  const qc = useQueryClient();
  const quizQ = useQuery({ queryKey: quizKey(id), queryFn: () => internshipApi.quiz(id) });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<"submit" | "exit" | null>(null);
  const autoSubmitted = useRef(false);

  const quiz = quizQ.data;
  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);

  const submit = useMutation({
    mutationFn: (a: Record<string, string>) => internshipApi.submitQuiz(id, a),
    onSuccess: (data) => {
      qc.setQueryData(quizKey(id), data);
      void qc.invalidateQueries({ queryKey: ["internship", "quizzes"] });
      void qc.invalidateQueries({ queryKey: ["internship", "skills"] });
      onSubmitted(data);
    },
  });

  // Start the countdown once the questions have loaded.
  useEffect(() => {
    if (quiz && quiz.status === "available" && deadline === null) {
      setDeadline(Date.now() + quiz.duration_min * 60_000);
    }
  }, [quiz, deadline]);

  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const secondsLeft = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  // The only automatic submission: the timer reaching zero.
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current && !submit.isPending && !submit.isSuccess) {
      autoSubmitted.current = true;
      setConfirming(null);
      submit.mutate(answers);
    }
  }, [secondsLeft, answers, submit]);

  if (quizQ.isPending) return <LoadingState rows={5} label="Loading weekly check" />;
  if (quizQ.isError)
    return (
      <div className="space-y-3">
        <ErrorState message={errorMessage(quizQ.error)} onRetry={() => quizQ.refetch()} />
        <Button variant="secondary" onClick={onExit}>
          <ArrowLeft aria-hidden="true" />
          Back to weekly checks
        </Button>
      </div>
    );
  if (!quiz) return null;
  if (quiz.status !== "available")
    return (
      <EmptyState
        message="This weekly check is no longer open."
        action={
          <Button variant="secondary" onClick={onExit}>
            Back to weekly checks
          </Button>
        }
      />
    );
  if (questions.length === 0)
    return (
      <EmptyState
        message="This weekly check has no questions."
        action={
          <Button variant="secondary" onClick={onExit}>
            Back to weekly checks
          </Button>
        }
      />
    );

  const current = questions[Math.min(index, questions.length - 1)];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const unanswered = questions.length - answeredCount;
  const timeUp = secondsLeft === 0;
  const locked = submit.isPending || timeUp;

  const requestSubmit = () => {
    if (unanswered > 0) setConfirming("submit");
    else submit.mutate(answers);
  };

  return (
    <Card className="space-y-5 p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
            Month {quiz.month_number} · Week {quiz.week_number}
          </span>
          <h2 className="text-base font-semibold text-text">{quiz.title}</h2>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-sm font-semibold text-text"
          aria-label="Time left"
        >
          <Timer className="size-4 text-muted" aria-hidden="true" />
          <span>{secondsLeft === null ? "—" : formatTimer(secondsLeft)}</span>
        </div>
      </div>

      <div className="space-y-5 px-6">
        <p className="text-xs text-muted">
          The timer is a guide for pacing. If it reaches zero, your answers so far are submitted automatically.
          Leaving this page discards your answers.
        </p>

        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-text">
            Question {index + 1} of {questions.length}
          </span>
          <Badge tone="neutral">{current.skill}</Badge>
        </div>

        <fieldset className="space-y-3" disabled={locked}>
          <legend className="whitespace-pre-line text-sm font-semibold leading-relaxed text-text">{current.body}</legend>
          <div className="space-y-2.5 pt-2">
            {current.options.map((opt) => {
              const selected = answers[current.id] === opt.key;
              return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500 ${
                    selected
                      ? "border-primary-500 bg-primary-50 text-text"
                      : "border-border bg-surface text-text hover:bg-surface-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${current.id}`}
                    value={opt.key}
                    checked={selected}
                    onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: opt.key }))}
                    className="sr-only"
                  />
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      selected ? "bg-primary-600 text-white" : "bg-surface-muted text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {opt.key}
                  </span>
                  <span className="flex-1 whitespace-pre-line">{opt.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Navigation */}
        <div className="border-t border-border pt-4">
          <span className="mb-2 block text-xs text-muted">
            Answered {answeredCount} of {questions.length}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  aria-label={`Question ${idx + 1}${isAnswered ? ", answered" : ", not answered"}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`size-8 rounded-lg text-xs font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                    isCurrent
                      ? "border-2 border-primary-600 bg-primary-50 text-primary-700"
                      : isAnswered
                        ? "bg-primary-600 text-white"
                        : "bg-surface-muted text-muted hover:text-text"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {confirming === "submit" && !locked && (
          <div role="alertdialog" aria-label="Unanswered questions" className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              You have {unanswered} unanswered {unanswered === 1 ? "question" : "questions"}.
            </p>
            <p className="mt-1">Unanswered questions are marked incorrect. Submit anyway?</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => submit.mutate(answers)}>
                Submit anyway
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                Keep answering
              </Button>
            </div>
          </div>
        )}

        {confirming === "exit" && !locked && (
          <div role="alertdialog" aria-label="Leave weekly check" className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Leave without submitting?
            </p>
            <p className="mt-1">Your answers will not be saved. The check stays open and the timer restarts.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={onExit}>
                Leave
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                Keep answering
              </Button>
            </div>
          </div>
        )}

        {timeUp && submit.isPending && (
          <p role="status" className="rounded-xl bg-info-50 p-3 text-sm text-info-700">
            Time is up — submitting your answers…
          </p>
        )}

        {submit.isError && (
          <ErrorState message={`Could not submit: ${errorMessage(submit.error)}`} onRetry={() => submit.mutate(answers)} />
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted px-6 py-4">
        <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={submit.isPending}
            onClick={() => (answeredCount > 0 ? setConfirming("exit") : onExit())}
          >
            Exit
          </Button>
          {index < questions.length - 1 ? (
            <Button variant="secondary" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>
              Next
            </Button>
          ) : null}
          <Button onClick={requestSubmit} disabled={locked}>
            {submit.isPending ? "Submitting…" : "Submit weekly check"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ results

function QuizResults({ id, justSubmitted, onBack }: { id: string; justSubmitted?: boolean; onBack: () => void }) {
  const quizQ = useQuery({ queryKey: quizKey(id), queryFn: () => internshipApi.quiz(id) });

  const back = (
    <Button variant="secondary" onClick={onBack}>
      <ArrowLeft aria-hidden="true" />
      Back to weekly checks
    </Button>
  );

  if (quizQ.isPending) return <LoadingState rows={5} label="Loading results" />;
  if (quizQ.isError)
    return (
      <div className="space-y-3">
        <ErrorState message={errorMessage(quizQ.error)} onRetry={() => quizQ.refetch()} />
        {back}
      </div>
    );
  const quiz = quizQ.data;
  const results = quiz.results;
  if (quiz.status !== "submitted" || !results)
    return <EmptyState message="Results are not available for this weekly check." action={back} />;

  const detailById = new Map(results.detail.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        {justSubmitted && (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success-700">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Your answers were submitted.
          </p>
        )}
      </div>

      <Card>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
          Month {quiz.month_number} · Week {quiz.week_number}
        </span>
        <h2 className="text-lg font-semibold text-text">{quiz.title}</h2>
        <p className="text-xs text-muted">Submitted {formatDate(quiz.submitted_at)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-center">
            <span className="text-xs font-medium text-primary-700">Score</span>
            <p className="mt-1 text-3xl font-bold text-primary-700">{results.score_pct}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-center">
            <span className="text-xs font-medium text-muted">Correct answers</span>
            <p className="mt-1 text-3xl font-bold text-text">
              {results.correct} <span className="text-base font-normal text-muted">/ {results.total}</span>
            </p>
          </div>
        </div>
      </Card>

      {results.misconceptions.length > 0 && (
        <Card className="border-warning-500 bg-warning-50">
          <CardTitle className="flex items-center gap-1.5 text-warning-800">
            <Lightbulb className="size-4" aria-hidden="true" />
            Ideas worth revisiting
          </CardTitle>
          <p className="mt-1 text-sm text-warning-800">
            You chose answers based on these misunderstandings more than once:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-800">
            {results.misconceptions.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      {results.skills.length > 0 && (
        <section className="space-y-3" aria-labelledby="skill-results-title">
          <h3 id="skill-results-title" className="text-sm font-semibold text-text">
            Results by skill
          </h3>
          <Table>
            <THead>
              <TR>
                <TH>Skill</TH>
                <TH className="text-right">Correct</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <TBody>
              {results.skills.map((s) => (
                <TR key={s.skill}>
                  <TD className="font-medium">{s.skill}</TD>
                  <TD className="text-right tabular-nums">
                    {s.correct} / {s.total}
                  </TD>
                  <TD className="text-right tabular-nums">{s.score_pct}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-xs text-muted">These results update your skill matrix.</p>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="question-results-title">
        <h3 id="question-results-title" className="text-sm font-semibold text-text">
          Question by question
        </h3>
        <ol className="space-y-4">
          {quiz.questions.map((q, idx) => {
            const d = detailById.get(q.id);
            const chosen = d?.chosen ?? null;
            const correctKey = d?.correct_key ?? q.correct_key;
            const explanation = d?.explanation || q.explanation;
            return (
              <li key={q.id}>
                <Card>
                  <CardHeader className="mb-3">
                    <div>
                      <CardDescription>
                        Question {idx + 1} · {q.skill}
                      </CardDescription>
                      <p className="mt-1 whitespace-pre-line text-sm font-semibold text-text">{q.body}</p>
                    </div>
                    {d &&
                      (d.correct ? (
                        <Badge tone="success">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <XCircle className="size-3.5" aria-hidden="true" />
                          {chosen ? "Incorrect" : "Not answered"}
                        </Badge>
                      ))}
                  </CardHeader>
                  <ul className="space-y-2">
                    {q.options.map((opt) => {
                      const isCorrect = opt.key === correctKey;
                      const isChosen = opt.key === chosen;
                      return (
                        <li
                          key={opt.key}
                          className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
                            isCorrect
                              ? "border-success-500 bg-success-50"
                              : isChosen
                                ? "border-danger-500 bg-danger-50"
                                : "border-border bg-surface"
                          }`}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted">
                            {opt.key}
                          </span>
                          <span className="flex-1 whitespace-pre-line text-text">{opt.text}</span>
                          {isCorrect && <span className="text-xs font-semibold text-success-700">Correct answer</span>}
                          {isChosen && !isCorrect && (
                            <span className="text-xs font-semibold text-danger-700">Your answer</span>
                          )}
                          {isChosen && isCorrect && (
                            <span className="sr-only">(your answer)</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {explanation && (
                    <p className="mt-3 rounded-lg bg-surface-muted p-3 text-sm text-text">
                      <span className="font-semibold">Explanation: </span>
                      {explanation}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ page

export function MenteeWeeklyMCQPage() {
  usePageTitle("Weekly MCQs & Knowledge Checks");
  const [view, setView] = useState<View>({ mode: "list" });
  const toList = () => setView({ mode: "list" });

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="primary">
          <FileQuestion className="size-3.5" aria-hidden="true" />
          Weekly knowledge checks
        </Badge>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Weekly Knowledge Checks</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          A short multiple-choice check on this week&apos;s topics. Your mentor approves each check before it
          appears here. Scores are calculated automatically when you submit, and your answers update your skill
          matrix.
        </p>
      </div>

      {view.mode === "list" && (
        <QuizList onOpen={(q) => setView(q.status === "submitted" ? { mode: "results", id: q.id } : { mode: "take", id: q.id })} />
      )}
      {view.mode === "take" && (
        <TakeQuiz
          key={view.id}
          id={view.id}
          onExit={toList}
          onSubmitted={(q) => setView({ mode: "results", id: q.id, justSubmitted: true })}
        />
      )}
      {view.mode === "results" && (
        <QuizResults key={view.id} id={view.id} justSubmitted={view.justSubmitted} onBack={toList} />
      )}
    </div>
  );
}
