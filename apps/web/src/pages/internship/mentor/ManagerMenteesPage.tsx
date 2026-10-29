import {
  CheckCircle2,
  Edit3,
  Mail,
  Phone,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipManagerForUser,
  getPersistedMentees,
  mockInternshipMentees,
  saveMenteeToStorage,
} from "@/lib/mockData";
import {
  type InternshipMentee,
  type SkillItem,
  type SkillLevel,
  SKILL_LEVEL_LABELS,
} from "@/lib/types";

export function ManagerMenteesPage() {
  usePageTitle("My Mentees & Skill Matrix");
  const { user } = useAuth();

  const [mentees, setMentees] = useState<InternshipMentee[]>(() => getPersistedMentees());
  const [selectedMenteeId, setSelectedMenteeId] = useState<string>("");
  const [editingSkill, setEditingSkill] = useState<{
    skillName: string;
    level: SkillLevel;
    evidenceNotes: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMenteeUpdate = () => setMentees(getPersistedMentees());
    window.addEventListener("eduproctor_mentees_updated", handleMenteeUpdate);
    return () => {
      window.removeEventListener("eduproctor_mentees_updated", handleMenteeUpdate);
    };
  }, []);

  const currentManager = getInternshipManagerForUser(user);
  const managerId = currentManager.id;
  const availableMentees = mentees.length > 0 ? mentees : mockInternshipMentees;
  const filteredMentees = availableMentees.filter((m) => m.managerId === managerId);
  const myMentees = filteredMentees.length > 0 ? filteredMentees : availableMentees.slice(0, 2);

  useEffect(() => {
    if (!selectedMenteeId && myMentees.length > 0) {
      setSelectedMenteeId(myMentees[0].id);
    }
  }, [myMentees, selectedMenteeId]);

  const activeMentee = myMentees.find((m) => m.id === selectedMenteeId) || myMentees[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveSkillLevel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !editingSkill) return;

    const updatedSkills: SkillItem[] = activeMentee.skills.map((s) => {
      if (s.name === editingSkill.skillName) {
        return {
          ...s,
          currentLevel: editingSkill.level,
          level: editingSkill.level,
          evidence: editingSkill.evidenceNotes,
          evidenceNotes: editingSkill.evidenceNotes,
          lastAssessedDate: new Date().toISOString().split("T")[0],
        };
      }
      return s;
    });

    const updatedMentee: InternshipMentee = {
      ...activeMentee,
      skills: updatedSkills,
    };

    saveMenteeToStorage(updatedMentee);
    setEditingSkill(null);
    showToast(`Updated "${editingSkill.skillName}" to Level ${editingSkill.level} (${SKILL_LEVEL_LABELS[editingSkill.level]})`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with 1:2 Policy Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <UserCheck className="size-3.5" />
            <span>Strict 1:2 Manager-to-Mentee Ratio Enforced</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Mentee Skill Evaluation Matrix
          </h1>
          <p className="text-xs text-slate-500">
            Multi-tier competency tracking across the 5-point skill ladder (Level 1 Awareness to Level 5 Architect/Lead).
          </p>
        </div>

        {/* Mentee Selector Tabs */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
          {myMentees.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMenteeId(m.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeMentee?.id === m.id
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m.avatar?.startsWith("http") || m.avatar?.startsWith("/") ? (
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                  {m.avatar || m.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span>{m.name.split(" ")[0]}</span>
              <span className="rounded bg-emerald-50 px-1 py-0.2 text-[10px] text-emerald-700">
                L{Math.round(m.skills.reduce((a, b) => a + (b.currentLevel ?? 1), 0) / m.skills.length)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeMentee && (
        <div className="space-y-6">
          {/* Mentee Profile Summary Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {activeMentee.avatar?.startsWith("http") || activeMentee.avatar?.startsWith("/") ? (
                  <img
                    src={activeMentee.avatar}
                    alt={activeMentee.name}
                    className="size-16 rounded-full border-2 border-emerald-500/20 object-cover shadow-2xs"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full border-2 border-emerald-500/20 bg-emerald-100 text-lg font-bold text-emerald-800 shadow-2xs">
                    {activeMentee.avatar || activeMentee.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900">{activeMentee.name}</h2>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {activeMentee.track}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      Month {activeMentee.currentMonth} of 3
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5 text-slate-400" />
                      {activeMentee.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5 text-slate-400" />
                      {activeMentee.phone}
                    </span>
                    <span>Roll: <strong className="text-slate-700">{activeMentee.rollNumber}</strong></span>
                    <span>Cohort: <strong className="text-slate-700">{activeMentee.cohortName}</strong></span>
                  </div>
                </div>
              </div>

              {/* Progress Gauges */}
              <div className="flex items-center gap-4 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                <div className="rounded-lg bg-emerald-50/70 p-3 text-center min-w-[90px]">
                  <p className="text-[11px] font-medium text-emerald-700">Composite</p>
                  <p className="text-xl font-bold text-emerald-800">{activeMentee.compositeScorePct}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center min-w-[90px]">
                  <p className="text-[11px] font-medium text-slate-600">Attendance</p>
                  <p className="text-xl font-bold text-slate-800">{activeMentee.attendanceRatePct}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center min-w-[90px]">
                  <p className="text-[11px] font-medium text-slate-600">Tasks Done</p>
                  <p className="text-xl font-bold text-slate-800">{activeMentee.tasksCompletedCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Point Skill Matrix Rubric Legend */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Standard 5-Point Skill Rubric (Evidence-Backed)
            </h3>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-5">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="size-2 rounded-full bg-slate-400" />
                  Level 1: Awareness
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Knows theory, needs step-by-step guidance.</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <div className="flex items-center gap-1.5 font-semibold text-blue-700">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Level 2: Guided
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Implements basic tasks with review.</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 bg-emerald-50/30">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <span className="size-2 rounded-full bg-emerald-600" />
                  Level 3: Independent
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Solves standard requirements autonomously.</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-purple-200">
                <div className="flex items-center gap-1.5 font-semibold text-purple-700">
                  <span className="size-2 rounded-full bg-purple-500" />
                  Level 4: Advanced
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Designs schemas, optimizes performance.</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-amber-200">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Level 5: Architect
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Drives architecture, coaches peers.</p>
              </div>
            </div>
          </div>

          {/* Detailed Skill Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Curriculum Skills for {activeMentee.track}
              </h3>
              <span className="text-xs text-slate-500">
                Target: Level 3+ across core modules for full-time conversion
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeMentee.skills.map((skill) => (
                <div
                  key={skill.name}
                  className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs transition-all hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{skill.name}</h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            (skill.currentLevel ?? 1) >= 4
                              ? "bg-purple-100 text-purple-800"
                              : (skill.currentLevel ?? 1) >= 3
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          Level {skill.currentLevel ?? 1}: {SKILL_LEVEL_LABELS[(skill.currentLevel ?? 1) as SkillLevel]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track: {activeMentee.track} · Last assessed: {skill.lastAssessedDate}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingSkill({
                          skillName: skill.name,
                          level: (skill.currentLevel ?? 1) as SkillLevel,
                          evidenceNotes: skill.evidence ?? skill.evidenceNotes ?? "",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="size-3 text-slate-500" />
                      <span>Update</span>
                    </button>
                  </div>

                  {/* Level Progress Visualizer (1-5) */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
                      <span>Progression (1 to 5 scale)</span>
                      <span>{skill.currentLevel ?? 1} / 5</span>
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

                  {/* Evidence Notes */}
                  <div className="mt-3.5 rounded-lg bg-slate-50/80 p-2.5 border border-slate-100">
                    <p className="text-[11px] font-medium text-slate-600">
                      <strong className="text-slate-800">Verified Evidence:</strong>{" "}
                      {skill.evidence ?? skill.evidenceNotes}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Skill Dialog Modal */}
          {editingSkill && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Update Skill Level: {editingSkill.skillName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mentee: {activeMentee.name} ({activeMentee.track})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSkill(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveSkillLevel} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Skill Level (1 to 5)
                    </label>
                    <select
                      value={editingSkill.level}
                      onChange={(e) =>
                        setEditingSkill({
                          ...editingSkill,
                          level: Number(e.target.value) as SkillLevel,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    >
                      <option value={1}>Level 1: Awareness (Theoretical knowledge)</option>
                      <option value={2}>Level 2: Guided Practice (Executes with supervision)</option>
                      <option value={3}>Level 3: Independent (Production capable)</option>
                      <option value={4}>Level 4: Advanced (Optimizations & Architecture)</option>
                      <option value={5}>Level 5: Architect / Lead (Guides team & establishes standards)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verified Evidence Notes & Pull Requests
                    </label>
                    <textarea
                      rows={3}
                      value={editingSkill.evidenceNotes}
                      onChange={(e) =>
                        setEditingSkill({
                          ...editingSkill,
                          evidenceNotes: e.target.value,
                        })
                      }
                      placeholder="e.g., Successfully integrated JWT auth with refresh rotation in sprint task #12. 100% unit test coverage."
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingSkill(null)}
                      className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      Save Skill Level
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
