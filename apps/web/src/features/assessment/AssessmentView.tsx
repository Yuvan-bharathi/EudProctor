import { CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/States";
import { Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnswerSync, type SyncStatus } from "./answerSync";
import { formatRemaining, makeClock } from "./clock";
import type { CandidateSession } from "./types";

const syncText: Record<SyncStatus, { icon: ReactNode; label: string }> = {
  saved: { icon: <CheckCircle2 className="size-4 text-success-700" aria-hidden="true" />, label: "All answers saved" },
  pending: { icon: <Loader2 className="size-4 text-muted" aria-hidden="true" />, label: "Saving soon" },
  saving: { icon: <Loader2 className="size-4 text-muted" aria-hidden="true" />, label: "Saving…" },
  offline: {
    icon: <CloudOff className="size-4 text-warning-800" aria-hidden="true" />,
    label: "Offline – answers are kept on this device",
  },
};

function Timer({ session, onExpire }: { session: CandidateSession; onExpire: () => void }) {
  const clock = useMemo(() => makeClock(session.server_now, session.deadline_at), [session.server_now, session.deadline_at]);
  const [remaining, setRemaining] = useState(() => clock.remainingMs() ?? 0);
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const r = clock.remainingMs() ?? 0;
      setRemaining(r);
      if (r <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [clock, onExpire]);
  const low = remaining < 5 * 60_000;
  return (
    <div className={cn("font-mono text-sm tabular-nums", low ? "text-warning-800" : "text-text")}>
      <span className="sr-only">Time left: </span>
      {formatRemaining(remaining)} left
    </div>
  );
}

export function AssessmentView({
  session,
  onSubmitted,
  onExpired,
  flagSlot,
}: {
  session: CandidateSession;
  onSubmitted: () => void;
  onExpired: () => void;
  flagSlot?: ReactNode;
}) {
  const questions = session.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(Object.entries(session.answers).map(([k, v]) => [k, v.value])),
  );
  const [status, setStatus] = useState<SyncStatus>("saved");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sync = useMemo(
    () =>
      new AnswerSync(session.id, (batch) =>
        api<{ acks: { question_id: string; client_seq: number; accepted: boolean }[] }>(
          `/sessions/${session.id}/answers`,
          { method: "PUT", body: { answers: batch } },
        ),
      ),
    [session.id],
  );

  useEffect(() => {
    const unsub = sync.subscribe(setStatus);
    const seqs = Object.fromEntries(Object.entries(session.answers).map(([k, v]) => [k, v.client_seq]));
    void sync.init(seqs).then((local) => {
      if (local.size) setAnswers((a) => ({ ...a, ...Object.fromEntries(local) }));
      void sync.flush();
    });
    sync.start();
    return () => {
      unsub();
      sync.stop();
    };
    // session.answers is only the initial snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  const q = questions[index];
  const answeredCount = questions.filter((x) => answers[x.id] && Object.keys(answers[x.id]).length).length;

  function choose(value: Record<string, unknown>) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    void sync.record(q.id, value);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    await sync.flush();
    try {
      await api(`/sessions/${session.id}/submit`, { method: "POST" });
      onSubmitted();
    } catch (err) {
      setSubmitError(`${errorMessage(err)} Your answers are kept – please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function expire() {
    await sync.flush();
    onExpired();
  }

  if (!q) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <EmptyState message="This assessment has no questions. Please contact your mentor." />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{session.exam_title}</h1>
          <p className="text-xs text-muted">
            Question {index + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1 text-xs text-muted sm:flex" role="status">
            {syncText[status].icon}
            {syncText[status].label}
          </span>
          {flagSlot}
          <Timer session={session} onExpire={expire} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] flex-1 gap-6 px-6 py-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Questions" className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-3 text-xs text-muted">
            {answeredCount} of {questions.length} answered
          </p>
          <ol className="grid grid-cols-5 gap-2 md:grid-cols-4">
            {questions.map((x, i) => {
              const answered = answers[x.id] && Object.keys(answers[x.id]).length > 0;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Question ${i + 1}${answered ? ", answered" : ""}`}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border text-sm transition-colors duration-150",
                      answered ? "border-primary-200 bg-primary-50 text-primary-700" : "border-border bg-surface text-text",
                      i === index && "border-primary-600 font-semibold",
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-6" aria-labelledby="q-title">
            <p className="mb-1 text-xs text-muted">
              {q.marks} mark{q.marks === 1 ? "" : "s"}
            </p>
            <h2 id="q-title" className="mb-5 text-lg font-medium leading-relaxed text-text">
              {q.body}
            </h2>
            {q.type === "mcq" ? (
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose one answer</legend>
                {q.options.map((o) => {
                  const selected = answers[q.id]?.option_key === o.key;
                  return (
                    <label
                      key={o.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors duration-150",
                        selected ? "border-primary-500 bg-primary-50" : "border-border hover:bg-surface-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        className="mt-0.5 size-4 accent-primary-600"
                        checked={selected}
                        onChange={() => choose({ option_key: o.key })}
                      />
                      <span className="text-text">{o.text}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <Textarea
                aria-label="Your answer"
                className="min-h-48"
                value={String(answers[q.id]?.text ?? "")}
                onChange={(e) => choose({ text: e.target.value })}
              />
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <Button variant="secondary" onClick={() => setIndex(index + 1)} disabled={index === questions.length - 1}>
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            {!confirming ? (
              <Button onClick={() => setConfirming(true)}>Submit assessment</Button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3" role="group" aria-label="Confirm submission">
                <span className="text-sm text-text">
                  {answeredCount} of {questions.length} answered. Submit now?
                </span>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                  Keep working
                </Button>
                <Button size="sm" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Yes, submit"}
                </Button>
                {submitError && <ErrorState message={submitError} onRetry={submit} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
