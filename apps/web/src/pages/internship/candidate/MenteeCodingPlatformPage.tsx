import {
  CheckCircle2,
  Code2,
  FileCode,
  Play,
  RotateCcw,
  Send,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { mockCodingChallenges } from "@/lib/mockData";

export function MenteeCodingPlatformPage() {
  usePageTitle("Coding Platform");

  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    mockCodingChallenges[0].id,
  );
  const activeChallenge =
    mockCodingChallenges.find((c) => c.id === selectedChallengeId) ||
    mockCodingChallenges[0];

  const [code, setCode] = useState<string>(activeChallenge.starterCode);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{
    ran: boolean;
    passCount: number;
    totalCount: number;
    details: { id: string; input: string; output: string; passed: boolean }[];
  }>({
    ran: false,
    passCount: 0,
    totalCount: 0,
    details: [],
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSelectChallenge = (id: string) => {
    setSelectedChallengeId(id);
    const ch = mockCodingChallenges.find((c) => c.id === id) || mockCodingChallenges[0];
    setCode(ch.starterCode);
    setTestResults({ ran: false, passCount: 0, totalCount: 0, details: [] });
  };

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const visibleCases = activeChallenge.testCases.filter((tc) => !tc.isHidden);
      const results = visibleCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        output: tc.expectedOutput,
        passed: true,
      }));
      setTestResults({
        ran: true,
        passCount: results.length,
        totalCount: results.length,
        details: results,
      });
      setIsRunning(false);
      showToast(`Passed ${results.length}/${results.length} sample test cases!`);
    }, 700);
  };

  const handleSubmitSolution = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const allCases = activeChallenge.testCases;
      const results = allCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        output: tc.expectedOutput,
        passed: true,
      }));
      setTestResults({
        ran: true,
        passCount: results.length,
        totalCount: results.length,
        details: results,
      });
      setIsSubmitting(false);
      showToast("Solution submitted! 100% tests passed. Sent to Priya Sharma for code-quality review.");
    }, 1000);
  };

  const handleResetCode = () => {
    setCode(activeChallenge.starterCode);
    showToast("Code reset to initial starter template.");
  };

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar: Problem Selection & Language Badge */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <Code2 className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              In-Browser Coding Sandbox · {activeChallenge.track}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedChallengeId}
                onChange={(e) => handleSelectChallenge(e.target.value)}
                className="font-bold text-slate-900 text-sm border-none bg-transparent p-0 focus:outline-hidden cursor-pointer"
              >
                {mockCodingChallenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.language.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetCode}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
          >
            <Play className="size-3.5 fill-current" />
            <span>{isRunning ? "Running Tests..." : "Run Sample Tests"}</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitSolution}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <Send className="size-3.5" />
            <span>{isSubmitting ? "Evaluating..." : "Submit Solution"}</span>
          </button>
        </div>
      </div>

      {/* Main Split IDE View (2 Columns) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left 5 Cols: Problem Description & Rubric */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-700">
                Difficulty: Level {activeChallenge.difficulty}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Memory: 256MB · Timeout: 2.0s
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
              <h3 className="font-bold text-slate-900 text-sm">{activeChallenge.title}</h3>
              <p className="whitespace-pre-line text-slate-600">{activeChallenge.description}</p>
            </div>

            {/* Rubric Breakdown */}
            <div className="mt-6 rounded-lg bg-slate-50 p-3.5 border border-slate-200/80">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                Grading Rubric Weights
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Correctness & Hidden Tests:</span>
                  <span className="font-semibold text-emerald-700">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Time & Space Complexity:</span>
                  <span className="font-semibold text-purple-700">25%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Code Quality & Readability:</span>
                  <span className="font-semibold text-blue-700">25%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Code Editor & Test Runner Console */}
        <div className="space-y-4 lg:col-span-7">
          {/* In-Browser Code Editor */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <FileCode className="size-4 text-emerald-400" />
                <span className="font-mono text-[11px] text-slate-300">
                  solution.{activeChallenge.language === "python" ? "py" : activeChallenge.language === "sql" ? "sql" : "js"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                UTF-8 · Tab Size: 2
              </span>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full resize-none border-none bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-300 focus:outline-hidden"
            />
          </div>

          {/* Test Runner & Output Console */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Terminal className="size-4 text-slate-500" />
                <span>Test Execution Output</span>
              </div>
              {testResults.ran && (
                <span className="font-mono text-xs font-bold text-emerald-700">
                  Passed {testResults.passCount} of {testResults.totalCount} tests
                </span>
              )}
            </div>

            <div className="mt-3">
              {!testResults.ran ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Click "Run Sample Tests" to execute against the sandbox runner.
                </div>
              ) : (
                <div className="space-y-2">
                  {testResults.details.map((tc, idx) => (
                    <div
                      key={tc.id}
                      className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-medium text-slate-800">
                            Test Case #{idx + 1}
                          </span>
                          <p className="font-mono text-[11px] text-slate-600">
                            Input: {tc.input} → Result: {tc.output}
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        SUCCESS (12ms)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

