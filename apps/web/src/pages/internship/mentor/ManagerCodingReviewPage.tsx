import {
  CheckCircle2,
  Code2,
  FileCode,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import {
  mockCodingChallenges,
  mockInternshipMentees,
} from "@/lib/mockData";

export function ManagerCodingReviewPage() {
  usePageTitle("Coding IDE & Submissions Review");

  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    mockCodingChallenges[0].id,
  );
  const [selectedMenteeId, setSelectedMenteeId] = useState<string>(
    mockInternshipMentees[0].id,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rubric scores
  const [correctnessScore, setCorrectnessScore] = useState<number>(50); // out of 50
  const [complexityScore, setComplexityScore] = useState<number>(23); // out of 25
  const [qualityScore, setQualityScore] = useState<number>(24); // out of 25
  const [managerFeedback, setManagerFeedback] = useState<string>(
    "Clean modular implementation. Effective use of Redis in-memory counting. Well-documented error handling.",
  );

  const activeChallenge =
    mockCodingChallenges.find((c) => c.id === selectedChallengeId) ||
    mockCodingChallenges[0];
  const activeMentee =
    mockInternshipMentees.find((m) => m.id === selectedMenteeId) ||
    mockInternshipMentees[0];

  const totalScore = correctnessScore + complexityScore + qualityScore;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(
      `Graded ${activeMentee.name}'s submission: ${totalScore}/100. Feedback sent to mentee.`,
    );
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
            <Code2 className="size-3.5" />
            <span>In-Browser Coding & Sandbox Evaluation</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Manager Code Review Studio
          </h1>
          <p className="text-xs text-slate-500">
            Evaluate code quality, test case execution (visible + hidden), and algorithmic complexity.
          </p>
        </div>

        {/* Filter Selectors */}
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase">Mentee</label>
            <select
              value={selectedMenteeId}
              onChange={(e) => setSelectedMenteeId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs"
            >
              {mockInternshipMentees.slice(0, 2).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.track})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase">Challenge</label>
            <select
              value={selectedChallengeId}
              onChange={(e) => setSelectedChallengeId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs"
            >
              {mockCodingChallenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.language})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main 2-Column Review Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Cols: Problem Details, Code Viewer, Test Cases */}
        <div className="space-y-4 lg:col-span-7">
          {/* Challenge Description Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 uppercase">
                  {activeChallenge.language}
                </span>
                <h2 className="font-bold text-slate-900 text-sm">{activeChallenge.title}</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Track: {activeChallenge.track}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {activeChallenge.description}
            </p>
          </div>

          {/* Submitted Code Editor View */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <FileCode className="size-4 text-emerald-400" />
                <span className="font-mono text-[11px] text-slate-300">
                  submission_{activeMentee.name.toLowerCase().replace(" ", "_")}.{activeChallenge.language === "python" ? "py" : activeChallenge.language === "sql" ? "sql" : "js"}
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                ● Tests Passed: 3/3 (100%)
              </span>
            </div>

            <pre className="p-4 font-mono text-xs leading-relaxed text-emerald-300 overflow-x-auto bg-slate-950 max-h-[380px]">
              <code>{activeChallenge.solution}</code>
            </pre>
          </div>

          {/* Test Case Execution Matrix */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3">
              Automated Test Runner Results
            </h3>
            <div className="space-y-2">
              {activeChallenge.testCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-medium text-slate-800">
                        Test Case #{idx + 1} {tc.isHidden ? "(Hidden test)" : "(Sample)"}
                      </span>
                      <p className="font-mono text-[11px] text-slate-500">
                        Input: {tc.input} → Expected: {tc.expectedOutput}
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    PASSED (14ms)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: AI Analysis & Manager Rubric Scoring */}
        <div className="space-y-4 lg:col-span-5">
          {/* AI Code Quality Assistant Card */}
          <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white p-4.5 shadow-2xs">
            <div className="flex items-center gap-2 text-purple-900 font-semibold text-xs mb-2">
              <Sparkles className="size-4 text-purple-600" />
              <span>AI Code Review Assistant Analysis</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="rounded-lg bg-white p-2.5 border border-purple-100">
                <strong className="text-slate-900 block mb-0.5">Complexity:</strong>
                <span className="font-mono text-purple-700 font-semibold">O(1) amortized time</span>, O(N) memory. Meets production SLA.
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-purple-100">
                <strong className="text-slate-900 block mb-0.5">Similarity & Plagiarism:</strong>
                <span className="text-emerald-700 font-semibold">4.2% match</span> (Well within originality threshold).
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-purple-100">
                <strong className="text-slate-900 block mb-0.5">Suggested Commendation:</strong>
                Handled IP header fallback (`X-Forwarded-For` vs remoteAddress) reliably.
              </div>
            </div>
          </div>

          {/* Manager Grading & Rubric Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Manager Evaluation Rubric</h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Score: {totalScore} / 100
              </span>
            </div>

            <form onSubmit={handleSaveReview} className="mt-4 space-y-4">
              {/* Correctness Slider (50%) */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Functional Correctness (Hidden Tests)</span>
                  <span className="font-bold text-emerald-700">{correctnessScore} / 50 pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={correctnessScore}
                  onChange={(e) => setCorrectnessScore(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Complexity Slider (25%) */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Algorithmic Complexity & Scale</span>
                  <span className="font-bold text-purple-700">{complexityScore} / 25 pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={complexityScore}
                  onChange={(e) => setComplexityScore(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Readability & Rubric (25%) */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Code Cleanliness, Naming & Types</span>
                  <span className="font-bold text-blue-700">{qualityScore} / 25 pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={qualityScore}
                  onChange={(e) => setQualityScore(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Feedback text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1-on-1 Feedback for Mentee
                </label>
                <textarea
                  rows={4}
                  value={managerFeedback}
                  onChange={(e) => setManagerFeedback(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                Sign Off & Publish Grade to Mentee
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
