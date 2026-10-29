import {
  Award,
  CheckCircle2,
  FileText,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipManagerForUser,
  getPersistedMonthlyReviews,
  saveMonthlyReview,
} from "@/lib/mockData";
import type { MonthlyReviewRecord } from "@/lib/types";

export function ManagerMonthlyReviewsPage() {
  usePageTitle("Monthly Reviews & Calibration");
  const { user } = useAuth();

  const [reviews, setReviews] = useState<MonthlyReviewRecord[]>(() =>
    getPersistedMonthlyReviews(),
  );
  const [selectedReviewId, setSelectedReviewId] = useState<string>("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleRevUpdate = () => setReviews(getPersistedMonthlyReviews());
    window.addEventListener("eduproctor_reviews_updated", handleRevUpdate);
    return () => {
      window.removeEventListener("eduproctor_reviews_updated", handleRevUpdate);
    };
  }, []);

  const currentManager = getInternshipManagerForUser(user);
  const managerId = currentManager.id;
  const filteredReviews = reviews.filter((r) => r.managerId === managerId);
  const myReviews = filteredReviews.length > 0 ? filteredReviews : reviews;

  useEffect(() => {
    if (!selectedReviewId && myReviews.length > 0) {
      setSelectedReviewId(myReviews[0].id);
    }
  }, [myReviews, selectedReviewId]);

  const activeReview =
    myReviews.find((r) => r.id === selectedReviewId) || myReviews[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSignAndPublish = () => {
    if (!activeReview) return;
    const updated: MonthlyReviewRecord = {
      ...activeReview,
      status: "approved",
      managerSignedAt: new Date().toISOString(),
    };
    saveMonthlyReview(updated);
    showToast(`Signed & Published Month ${activeReview.monthNumber} Review for ${activeReview.menteeName}!`);
  };

  const handleGenerateAIDraft = () => {
    if (!activeReview) return;
    setIsGeneratingAI(true);
    setTimeout(() => {
      const updated: MonthlyReviewRecord = {
        ...activeReview,
        qualitativeSummary: `${activeReview.menteeName} demonstrated exceptional velocity in Month ${activeReview.monthNumber}. Completed 100% of sprint deliverables with high test-driven code quality. Communication was crisp and well-structured during tech demos.`,
        strengths: [
          "Outstanding API architectural design using Express router and middleware",
          "Thorough unit test coverage exceeding 90% in test runner",
          "Consistent 98% daily attendance and proactive sprint standups",
        ],
        growthAreas: [
          "Deepen understanding of MongoDB aggregation pipelines and compound indexes",
          "Focus on asynchronous error boundary handling under network latency",
        ],
        nextMonthGoals: [
          "Design microservice architecture with Redis pub/sub messaging",
          "Deliver capstone project with automated CI/CD pipeline",
          "Conduct peer review for junior cohort members",
        ],
      };
      saveMonthlyReview(updated);
      setIsGeneratingAI(false);
      showToast("AI Review Synthesis completed and applied!");
    }, 900);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Award className="size-3.5" />
            <span>5-Pillar Weighted Scorecard</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Monthly Performance Reviews
          </h1>
          <p className="text-xs text-slate-500">
            Formula: MCQ (25%) + Coding (30%) + Comm (20%) + Tasks (20%) + Attendance (5%).
          </p>
        </div>

        {/* Mentee Selector */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
          {myReviews.map((rev) => (
            <button
              key={rev.id}
              type="button"
              onClick={() => setSelectedReviewId(rev.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeReview?.id === rev.id
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>{rev.menteeName}</span>
              <span className="ml-1.5 rounded bg-emerald-50 px-1 py-0.2 text-[10px] text-emerald-700">
                {rev.compositeScorePct}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeReview && (
        <div className="space-y-6">
          {/* Top Banner Card: Composite Score and Status */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Month {activeReview.monthNumber} Evaluation: {activeReview.menteeName}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      activeReview.status === "approved" || activeReview.status === "acknowledged"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Status: {activeReview.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Manager: {activeReview.managerName} · Evaluated against track rubrics
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isGeneratingAI}
                  onClick={handleGenerateAIDraft}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer"
                >
                  <Sparkles className="size-4 text-purple-600" />
                  <span>{isGeneratingAI ? "Synthesizing AI Summary..." : "Regenerate AI Draft"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignAndPublish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                >
                  <Send className="size-4" />
                  <span>Sign & Publish to Mentee</span>
                </button>
              </div>
            </div>

            {/* 5-Pillar Scorecard Breakdown Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 sm:grid-cols-6">
              <div className="rounded-lg bg-emerald-50/70 p-3 text-center border border-emerald-200 sm:col-span-2">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Composite Final Score
                </span>
                <p className="mt-1 text-3xl font-black text-emerald-800">
                  {activeReview.compositeScorePct}%
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">Weighted across all 5 pillars</p>
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
            {/* Left: Summary & Strengths */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="size-4 text-purple-600" />
                  AI Synthesis & Overview
                </h3>
                <p className="mt-2 text-xs text-slate-700 leading-relaxed rounded-lg bg-slate-50 p-3">
                  {activeReview.qualitativeSummary}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  Key Strengths
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
                  Growth Areas
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

            {/* Right: Goals for Next Month & 1-on-1 Notes */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="size-4 text-emerald-600" />
                  Adopted Goals for Month {activeReview.monthNumber + 1}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These goals will automatically populate next month's sprint tasks
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

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager 1-on-1 Discussion Notes
                </label>
                <textarea
                  rows={3}
                  value={activeReview.managerNotes}
                  onChange={(e) => {
                    const updated = { ...activeReview, managerNotes: e.target.value };
                    saveMonthlyReview(updated);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
                {activeReview.managerSignedAt ? (
                  <p className="text-emerald-700 font-medium">
                    ✔ Signed by Manager on {new Date(activeReview.managerSignedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-amber-700">Awaiting Manager final sign-off</p>
                )}
                {activeReview.menteeAcknowledgedAt && (
                  <p className="text-emerald-700 font-medium mt-1">
                    ✔ Acknowledged by Mentee on {new Date(activeReview.menteeAcknowledgedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
