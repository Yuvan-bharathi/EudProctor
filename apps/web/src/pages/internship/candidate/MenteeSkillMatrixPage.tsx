import {
  BookOpen,
  LineChart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipMenteeForUser,
} from "@/lib/mockData";
import {
  SKILL_LEVEL_LABELS,
} from "@/lib/types";

export function MenteeSkillMatrixPage() {
  usePageTitle("My Skill Matrix (1-5)");
  const { user } = useAuth();
  const myProfile = getInternshipMenteeForUser(user);

  const avgLevel =
    myProfile?.skills.length > 0
      ? (
          myProfile.skills.reduce((acc, s) => acc + (s.currentLevel ?? s.level ?? 1), 0) /
          myProfile.skills.length
        ).toFixed(1)
      : "3.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <LineChart className="size-3.5" />
            <span>Track Competency Model</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            My Skill Competency Matrix ({myProfile?.track})
          </h1>
          <p className="text-xs text-slate-500">
            Assessed along the standard 5-point skill ladder (Level 1 Awareness to Level 5 Architect). Target Level 3+ across all skills for Month 3 full-time conversion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-center shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Average Level</span>
            <p className="text-xl font-black text-emerald-700">Level {avgLevel}</p>
          </div>
        </div>
      </div>

      {/* 5-Level Rubric Legend */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Competency Ladder Rubric
        </h3>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-5">
          <div className="rounded-lg bg-white p-2.5 border border-slate-200">
            <span className="font-semibold text-slate-700">Level 1: Awareness</span>
            <p className="mt-1 text-[11px] text-slate-500">Understands basic concepts and syntax.</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-slate-200">
            <span className="font-semibold text-blue-700">Level 2: Guided</span>
            <p className="mt-1 text-[11px] text-slate-500">Delivers components with pair guidance.</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-emerald-300 bg-emerald-50/40">
            <span className="font-semibold text-emerald-800">Level 3: Independent ★</span>
            <p className="mt-1 text-[11px] text-slate-500">Builds production-grade features independently.</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-purple-200">
            <span className="font-semibold text-purple-700">Level 4: Advanced</span>
            <p className="mt-1 text-[11px] text-slate-500">Optimizes performance, schemas & scaling.</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-amber-200">
            <span className="font-semibold text-amber-700">Level 5: Architect</span>
            <p className="mt-1 text-[11px] text-slate-500">Drives system design and technical excellence.</p>
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Core Skills ({myProfile?.skills.length} Modules)
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {myProfile?.skills.map((skill) => (
            <div
              key={skill.name}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{skill.name}</h4>
                  <p className="text-xs text-slate-500">
                    Last validated: {skill.lastAssessedDate}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    (skill.currentLevel ?? 1) >= 4
                      ? "bg-purple-100 text-purple-800"
                      : (skill.currentLevel ?? 1) >= 3
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                  }`}
                >
                  Level {skill.currentLevel ?? 1}: {SKILL_LEVEL_LABELS[skill.currentLevel ?? 1]}
                </span>
              </div>

              {/* 5-bar visualization */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Level Progress</span>
                  <span className="font-semibold">{skill.currentLevel ?? 1} of 5</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-2 rounded-full ${
                        lvl <= (skill.currentLevel ?? 1)
                          ? lvl >= 4
                            ? "bg-purple-600"
                            : lvl >= 3
                              ? "bg-emerald-600"
                              : "bg-blue-600"
                          : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Evidence box */}
              <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Manager Verified Evidence
                </span>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  {skill.evidence ?? skill.evidenceNotes}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <Link
                  to="/candidate/practice"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <BookOpen className="size-3.5" />
                  <span>Practice Questions for {skill.name}</span>
                </Link>
                <Link
                  to="/candidate/internship/coding"
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Solve Coding Tasks →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
