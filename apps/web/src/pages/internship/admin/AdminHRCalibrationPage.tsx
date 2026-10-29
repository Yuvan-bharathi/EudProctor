import {
  CheckCircle2,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import {
  mockInternshipManagers,
  mockInternshipMentees,
} from "@/lib/mockData";
import type { InternshipMentee } from "@/lib/types";

interface ConversionDecision {
  menteeId: string;
  status: "FTE_OFFER" | "EXTEND_INTERNSHIP" | "CERTIFICATE" | "PENDING";
  notes: string;
}

export function AdminHRCalibrationPage() {
  usePageTitle("HR Calibration & Final Decisions");

  const [mentees] = useState<InternshipMentee[]>(mockInternshipMentees);
  const [decisions, setDecisions] = useState<Record<string, ConversionDecision>>({
    "mentee-1": { menteeId: "mentee-1", status: "FTE_OFFER", notes: "Top performer in MERN track with Level 3.4 across all skills." },
    "mentee-2": { menteeId: "mentee-2", status: "FTE_OFFER", notes: "Consistently delivered clean REST API PRs with zero rework." },
    "mentee-3": { menteeId: "mentee-3", status: "PENDING", notes: "Strong SQL skills; reviewing data pipeline project." },
    "mentee-4": { menteeId: "mentee-4", status: "EXTEND_INTERNSHIP", notes: "Additional month recommended for PyTorch fine-tuning." },
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSetDecision = (
    menteeId: string,
    status: ConversionDecision["status"],
  ) => {
    setDecisions((prev) => ({
      ...prev,
      [menteeId]: {
        menteeId,
        status,
        notes: prev[menteeId]?.notes || "HR calibrated decision.",
      },
    }));
    showToast(`Updated conversion decision: ${status.replace("_", " ")}`);
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
            <SlidersHorizontal className="size-3.5" />
            <span>Graduation & Hiring Conversion Committee</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            HR Calibration & Final Offer Decisions
          </h1>
          <p className="text-xs text-slate-500">
            Audit manager grading curves to eliminate leniency or harshness variance, and sign off Month 3 full-time engineering conversions.
          </p>
        </div>
      </div>

      {/* Cross-Manager Grading Variance Section */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Scale className="size-4 text-emerald-600" />
              Cross-Manager Scoring Calibration Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Evaluates manager scoring distributions to normalize grade variance
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            Variance: Low (±2.8%)
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="pb-2.5">Manager</th>
                <th className="pb-2.5">Track</th>
                <th className="pb-2.5">Avg MCQ (25%)</th>
                <th className="pb-2.5">Avg Coding (30%)</th>
                <th className="pb-2.5">Avg Comm (20%)</th>
                <th className="pb-2.5">Avg Tasks (20%)</th>
                <th className="pb-2.5">Composite Avg</th>
                <th className="pb-2.5">Curve Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockInternshipManagers.map((mgr) => {
                const isPriya = mgr.name.includes("Priya");
                const isRohan = mgr.name.includes("Rohan");
                const avgScore = isPriya ? 87.5 : isRohan ? 85.0 : 88.0;

                return (
                  <tr key={mgr.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        {mgr.avatar?.startsWith("http") || mgr.avatar?.startsWith("/") ? (
                          <img
                            src={mgr.avatar}
                            alt=""
                            className="size-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-700">
                            {mgr.avatar || mgr.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span>{mgr.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-700">{mgr.track}</td>
                    <td className="py-3 font-mono text-slate-800">{isPriya ? "86%" : "84%"}</td>
                    <td className="py-3 font-mono text-slate-800">{isPriya ? "90%" : "86%"}</td>
                    <td className="py-3 font-mono text-slate-800">{isPriya ? "84%" : "82%"}</td>
                    <td className="py-3 font-mono text-slate-800">{isPriya ? "92%" : "89%"}</td>
                    <td className="py-3 font-bold text-emerald-700">{avgScore}%</td>
                    <td className="py-3">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Balanced (Calibrated)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month-3 Full-Time Conversion Board */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Month 3 Final Full-Time (FTE) Conversion Decisions
            </h3>
            <p className="text-xs text-slate-500">
              Sign off full-time engineering offers or contract extensions
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {mentees.length} mentees evaluating for hiring
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {mentees.map((mentee) => {
            const dec = decisions[mentee.id]?.status || "PENDING";
            return (
              <div
                key={mentee.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {mentee.avatar?.startsWith("http") || mentee.avatar?.startsWith("/") ? (
                    <img
                      src={mentee.avatar}
                      alt={mentee.name}
                      className="size-11 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-emerald-100 text-xs font-bold text-emerald-800">
                      {mentee.avatar || mentee.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{mentee.name}</h4>
                      <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                        {mentee.track}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                        Score: {mentee.compositeScorePct}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manager: {mentee.managerName} · Attendance: {mentee.attendanceRatePct}% · Tasks: {mentee.tasksCompletedCount}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 italic">
                      Note: {decisions[mentee.id]?.notes || "Awaiting final review."}
                    </p>
                  </div>
                </div>

                {/* Decision Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetDecision(mentee.id, "FTE_OFFER")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      dec === "FTE_OFFER"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                    }`}
                  >
                    ✔ Full-Time Offer (FTE)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDecision(mentee.id, "EXTEND_INTERNSHIP")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      dec === "EXTEND_INTERNSHIP"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    }`}
                  >
                    Extend 1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDecision(mentee.id, "CERTIFICATE")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      dec === "CERTIFICATE"
                        ? "bg-slate-800 text-white shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Standard Certificate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
