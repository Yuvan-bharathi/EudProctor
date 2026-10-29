import {
  Award,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipMenteeForUser,
  getPersistedMonthlyReviews,
  saveMonthlyReview,
} from "@/lib/mockData";
import type { MonthlyReviewRecord } from "@/lib/types";

export function MenteeMonthlyReviewsPage() {
  usePageTitle("Monthly Reviews & Growth");
  const { user } = useAuth();
  const mentee = getInternshipMenteeForUser(user);
  const menteeId = mentee.id;
  const [reviews, setReviews] = useState<MonthlyReviewRecord[]>(() =>
    getPersistedMonthlyReviews(),
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleRevUpdate = () => setReviews(getPersistedMonthlyReviews());
    window.addEventListener("eduproctor_reviews_updated", handleRevUpdate);
    return () => {
      window.removeEventListener("eduproctor_reviews_updated", handleRevUpdate);
    };
  }, []);

  const myReviews = reviews.filter((r) => r.menteeId === menteeId);
  const [selectedMonth, setSelectedMonth] = useState<1 | 2 | 3>(2);

  const activeReview =
    myReviews.find((r) => r.monthNumber === selectedMonth) || myReviews[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAcknowledge = () => {
    if (!activeReview) return;
    const updated: MonthlyReviewRecord = {
      ...activeReview,
      status: "acknowledged",
      menteeAcknowledgedAt: new Date().toISOString(),
    };
    saveMonthlyReview(updated);
    showToast(`Acknowledged Month ${activeReview.monthNumber} Review! Goals adopted for next month.`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Award className="size-3.5" />
            <span>Monthly Performance Calibration</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            My Monthly Reviews & Scorecards
          </h1>
          <p className="text-xs text-slate-500">
            Transparent 5-pillar evaluations scored by your manager (MCQ 25%, Coding 30%, Comm 20%, Tasks 20%, Attendance 5%).
          </p>
        </div>

        {/* Month Selector Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {([1, 2, 3] as const).map((m) => {
            const hasReview = myReviews.some((r) => r.monthNumber === m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMonth(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  selectedMonth === m
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Month {m} {hasReview ? "✔" : "(Upcoming)"}
              </button>
            );
          })}
        </div>
      </div>

      {activeReview ? (
        <div className="space-y-6">
          {/* Top Banner Card: Composite Score and Acknowledge */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Month {activeReview.monthNumber} Performance Evaluation
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      activeReview.status === "acknowledged"
                        ? "bg-emerald-100 text-emerald-800"
                        : activeReview.status === "approved"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {activeReview.status === "acknowledged"
                      ? "Acknowledged by You"
                      : activeReview.status === "approved"
                        ? "Published by Manager"
                        : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Manager: {activeReview.managerName} · Evaluated against track standards
                </p>
              </div>

              <div>
                {activeReview.status === "approved" ? (
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>Acknowledge Review & Adopt Goals</span>
                  </button>
                ) : activeReview.status === "acknowledged" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Acknowledged on {activeReview.menteeAcknowledgedAt ? new Date(activeReview.menteeAcknowledgedAt).toLocaleDateString() : "today"}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Pending manager sign-off
                  </span>
                )}
              </div>
            </div>

            {/* 5-Pillar Scorecard Breakdown Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 sm:grid-cols-6">
              <div className="rounded-lg bg-emerald-50/70 p-3 text-center border border-emerald-200 sm:col-span-2">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Composite Graduation Score
                </span>
                <p className="mt-1 text-3xl font-black text-emerald-800">
                  {activeReview.compositeScorePct}%
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">5-Pillar Weighted Score</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-center border border-slate-200/80">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">MCQ (25%)</span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activeReview.breakdown.mcqScorePct}%
                </p>
                <p className="text-[10px] text-slate-400">Proctored</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-center border border-slate-200/80">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Coding (30%)</span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activeReview.breakdown.codingScorePct}%
                </p>
                <p className="text-[10px] text-slate-400">Sandbox tests</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-center border border-slate-200/80">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Comm (20%)</span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activeReview.breakdown.commScorePct}%
                </p>
                <p className="text-[10px] text-slate-400">Rubric score</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-center border border-slate-200/80">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Tasks (20%)</span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activeReview.breakdown.tasksScorePct}%
                </p>
                <p className="text-[10px] text-slate-400">PRs & Sprints</p>
              </div>
            </div>
          </div>

          {/* Qualitative Synthesis & Goals */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="size-4 text-purple-600" />
                  Performance Summary & Feedback
                </h3>
                <p className="mt-2 text-xs text-slate-700 leading-relaxed rounded-lg bg-slate-50 p-3">
                  {activeReview.qualitativeSummary}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  Recognized Strengths
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {activeReview.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✔</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                  Growth Areas & Improvement
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {activeReview.growthAreas.map((ga, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">●</span>
                      <span>{ga}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="size-4 text-emerald-600" />
                  Your Focus Goals for Month {activeReview.monthNumber + 1}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agreed upon during 1-on-1 coaching with your manager
                </p>

                <div className="mt-3 space-y-2">
                  {activeReview.nextMonthGoals.map((goal, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        {i + 1}
                      </span>
                      <span>{goal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {activeReview.managerNotes && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="font-semibold text-slate-700 text-xs block mb-1">
                    Manager 1-on-1 Meeting Notes:
                  </span>
                  <p className="rounded-lg bg-emerald-50/60 p-2.5 text-xs text-emerald-900 border border-emerald-100">
                    "{activeReview.managerNotes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center text-slate-500 text-xs">
          Review for Month {selectedMonth} has not been published yet by your manager.
        </div>
      )}
    </div>
  );
}
