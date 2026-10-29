import {
  CalendarCheck2,
  Code2,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import {
  mockInternshipCohorts,
  mockInternshipManagers,
  mockInternshipMentees,
} from "@/lib/mockData";

export function AdminInternshipDashboardPage() {
  usePageTitle("Internship Programme Dashboard");

  const [cohorts] = useState(mockInternshipCohorts);
  const [managers] = useState(mockInternshipManagers);
  const [mentees] = useState(mockInternshipMentees);

  const totalInterns = mentees.length;
  const totalManagers = managers.length;
  const avgAttendance = 97.2;
  const avgCompositeScore = Math.round(
    mentees.reduce((a, b) => a + b.compositeScorePct, 0) / mentees.length,
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="size-3 text-emerald-600" />
              <span>HR & L&D Programme Administration</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Internship Programme Executive Overview
            </h1>
            <p className="max-w-2xl text-xs text-slate-600 sm:text-sm">
              Managing 3-month cohorts across MERN Full Stack, Data Analyst, and AI/ML tracks. Strict 1:2 manager mentorship ratio and multi-pillar evaluation.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/admin/internship/cohorts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Layers className="size-4 text-slate-500" />
              <span>Cohorts & Pairings</span>
            </Link>
            <Link
              to="/admin/internship/calibration"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <SlidersHorizontal className="size-4" />
              <span>HR Calibration View</span>
            </Link>
          </div>
        </div>

        {/* Programme Track Pills */}
        <div className="mt-5 grid grid-cols-1 gap-2 pt-4 border-t border-emerald-100/80 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-800">FS</span>
            <div>
              <p className="font-semibold text-slate-900">MERN Full Stack Track</p>
              <p className="text-[11px] text-slate-500">React, Node/Express, MongoDB, REST</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-800">DA</span>
            <div>
              <p className="font-semibold text-slate-900">Data Analyst Track</p>
              <p className="text-[11px] text-slate-500">SQL, pandas, Statistics, Power BI</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-purple-100 text-xs font-bold text-purple-800">AI</span>
            <div>
              <p className="font-semibold text-slate-900">AI / ML Track</p>
              <p className="text-[11px] text-slate-500">Python, scikit-learn, PyTorch, RAG</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Active Interns (Mentees)</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalInterns}</p>
          <span className="text-[11px] text-emerald-600 font-medium">100% paired with managers</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Dedicated Managers</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalManagers}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Strict 1:2 ratio enforced</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Mean Attendance Rate</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{avgAttendance}%</p>
          <span className="text-[11px] text-slate-500">Across all 3 cohorts</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Cohort Score Average</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{avgCompositeScore}%</p>
          <span className="text-[11px] text-purple-700 font-medium">High readiness conversion</span>
        </div>
      </div>

      {/* Cohorts Overview Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Active Internship Cohorts (2026-Q1)
          </h2>
          <Link
            to="/admin/internship/cohorts"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Manage Pairings & Limits →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cohorts.map((cohort) => (
            <div
              key={cohort.id}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {cohort.track}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  Month 2 of 3
                </span>
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900">{cohort.name}</h3>
              <p className="mt-1 text-xs text-slate-500">
                Start: {cohort.startDate} · End: {cohort.endDate}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <span className="text-slate-500">Interns Enrolled:</span>
                  <p className="font-bold text-slate-800">{cohort.totalMentees} Mentees</p>
                </div>
                <div>
                  <span className="text-slate-500">Managers Assigned:</span>
                  <p className="font-bold text-slate-800">{cohort.activeManagers} Leads</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  1:2 Ratio Compliant
                </span>
                <Link
                  to="/admin/internship/cohorts"
                  className="text-xs font-semibold text-slate-700 hover:text-emerald-700"
                >
                  View Pairings →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Columns: Quick Manager-Mentee Pairings & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Manager Mentorship Allocations</h3>
              <p className="text-xs text-slate-500">Enforcing max 2 mentees per manager policy</p>
            </div>
            <Link
              to="/admin/internship/cohorts"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Reassign Pairings →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {managers.map((mgr) => {
              const assignedMentees = mentees.filter((m) => mgr.activeMenteeIds.includes(m.id));
              return (
                <div
                  key={mgr.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {mgr.avatar?.startsWith("http") || mgr.avatar?.startsWith("/") ? (
                      <img
                        src={mgr.avatar}
                        alt={mgr.name}
                        className="size-9 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                        {mgr.avatar || mgr.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{mgr.name}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                          {mgr.track}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Mentees: {assignedMentees.map((m) => m.name).join(", ") || "None"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      mgr.activeMenteeIds.length >= 2
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {mgr.activeMenteeIds.length} / 2 Mentees (At Capacity)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Quick Links & Actions */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs lg:col-span-5 space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm">Programme Administration Tools</h3>

          <div className="space-y-2.5">
            <Link
              to="/admin/internship/calibration"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs hover:border-emerald-300 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="size-4 text-emerald-600" />
                <div>
                  <p className="font-bold text-slate-900">HR Calibration & Final Offers</p>
                  <p className="text-slate-500 text-[11px]">Compare manager grading variance & sign off full-time conversions</p>
                </div>
              </div>
              <span>→</span>
            </Link>

            <Link
              to="/admin/internship/coding-bank"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs hover:border-emerald-300 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="size-4 text-blue-600" />
                <div>
                  <p className="font-bold text-slate-900">Coding Problem Bank</p>
                  <p className="text-slate-500 text-[11px]">Manage JavaScript, Python, and SQL coding challenges with test suites</p>
                </div>
              </div>
              <span>→</span>
            </Link>

            <Link
              to="/admin/internship/attendance"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs hover:border-emerald-300 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <CalendarCheck2 className="size-4 text-purple-600" />
                <div>
                  <p className="font-bold text-slate-900">Programme Attendance Audit</p>
                  <p className="text-slate-500 text-[11px]">Inspect check-in/out logs and export monthly timesheets</p>
                </div>
              </div>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
