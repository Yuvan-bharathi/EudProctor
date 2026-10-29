import { Code2 } from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { mockCodingChallenges } from "@/lib/mockData";
import type { CodingChallenge } from "@/lib/types";

export function AdminCodingBankPage() {
  usePageTitle("Coding Problem Bank");

  const [challenges] = useState<CodingChallenge[]>(mockCodingChallenges);
  const [filterTrack, setFilterTrack] = useState<string>("all");
  const [selectedChallenge, setSelectedChallenge] = useState<CodingChallenge | null>(null);

  const filtered = challenges.filter((c) => {
    if (filterTrack !== "all" && c.track !== filterTrack) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Code2 className="size-3.5" />
            <span>Interactive Assessment Engine</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Coding Problem Bank & Test Suites
          </h1>
          <p className="text-xs text-slate-500">
            Repository of technical challenges across JavaScript, Python, and SQL with sandboxed test runners and code quality rubrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
          >
            <option value="all">All Tracks</option>
            <option value="Full Stack (MERN)">Full Stack (MERN)</option>
            <option value="Data Analyst">Data Analyst</option>
            <option value="AI / ML Engineer">AI / ML Engineer</option>
          </select>
        </div>
      </div>

      {/* Challenges Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedChallenge(item)}
            className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-xs cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold uppercase text-slate-700">
                  {item.language}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Difficulty L{item.difficulty}
                </span>
              </div>

              <h3 className="mt-3 font-bold text-slate-900 text-sm">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">{item.testCases.length} Test Cases</span>
              <span className="font-semibold text-emerald-700">View Rubric →</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase">
                  {selectedChallenge.track} · {selectedChallenge.language.toUpperCase()}
                </span>
                <h3 className="text-base font-bold text-slate-900">{selectedChallenge.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChallenge(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Description:</span>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedChallenge.description}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Test Suites:</span>
                <div className="space-y-1.5">
                  {selectedChallenge.testCases.map((tc, idx) => (
                    <div
                      key={tc.id}
                      className="rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700 border border-slate-200"
                    >
                      <span className="font-bold text-slate-900">Case {idx + 1} {tc.isHidden ? "(Hidden)" : "(Visible)"}:</span> Input: {tc.input} → Expected: {tc.expectedOutput}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Reference Solution:</span>
                <pre className="rounded-lg bg-slate-950 p-3 font-mono text-emerald-300 text-xs overflow-x-auto">
                  <code>{selectedChallenge.solution}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
