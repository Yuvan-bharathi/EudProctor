import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import {
  mockInternshipManagers,
  mockInternshipMentees,
} from "@/lib/mockData";
import type { InternshipManager, InternshipMentee } from "@/lib/types";

export function AdminCohortsPage() {
  usePageTitle("Cohorts & Mentorship Pairings");

  const [managers, setManagers] = useState<InternshipManager[]>(mockInternshipManagers);
  const [mentees, setMentees] = useState<InternshipMentee[]>(mockInternshipMentees);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [selectedMenteeId, setSelectedMenteeId] = useState(mockInternshipMentees[0].id);
  const [targetManagerId, setTargetManagerId] = useState(mockInternshipManagers[0].id);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenModal = (menteeId?: string) => {
    if (menteeId) setSelectedMenteeId(menteeId);
    setPairingError(null);
    setIsPairingModalOpen(true);
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMgr = managers.find((m) => m.id === targetManagerId);
    const targetMentee = mentees.find((m) => m.id === selectedMenteeId);

    if (!targetMgr || !targetMentee) return;

    // Check if the mentee is already assigned to this manager
    if (targetMgr.activeMenteeIds.includes(targetMentee.id)) {
      setPairingError(`${targetMentee.name} is already assigned to ${targetMgr.name}.`);
      return;
    }

    // STRICT CHECK: Max 2 mentees per manager!
    if (targetMgr.activeMenteeIds.length >= 2) {
      setPairingError(
        `POLICY LIMIT: ${targetMgr.name} already has 2 active mentees (${targetMgr.activeMenteeIds.length}/2). No manager can be assigned more than 2 mentees. Please choose another manager.`,
      );
      return;
    }

    // Perform re-assignment
    const updatedManagers = managers.map((mgr) => {
      // Remove mentee from former manager
      const filtered = mgr.activeMenteeIds.filter((id) => id !== targetMentee.id);
      // Add to new manager
      if (mgr.id === targetMgr.id) {
        return { ...mgr, activeMenteeIds: [...filtered, targetMentee.id] };
      }
      return { ...mgr, activeMenteeIds: filtered };
    });

    const updatedMentees = mentees.map((m) => {
      if (m.id === targetMentee.id) {
        return {
          ...m,
          managerId: targetMgr.id,
          managerName: targetMgr.name,
        };
      }
      return m;
    });

    setManagers(updatedManagers);
    setMentees(updatedMentees);
    setIsPairingModalOpen(false);
    showToast(`Successfully assigned ${targetMentee.name} to ${targetMgr.name} (Compliant with 1:2 limit).`);
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
            <Users className="size-3.5" />
            <span>Cohort & Mentorship Administration</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Cohorts & Manager-Mentee Pairings
          </h1>
          <p className="text-xs text-slate-500">
            Manage cohort timelines and enforce the strict 1:2 manager-to-mentee ratio policy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
        >
          <UserPlus className="size-4" />
          <span>Assign / Reassign Mentee</span>
        </button>
      </div>

      {/* Strict 1:2 Mentorship Policy Alert Callout */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-xs text-emerald-950">
              Strict 1:2 Ratio Mentorship Guarantee
            </h3>
            <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
              Every manager is paired with a maximum of 2 mentees to guarantee intensive coaching, frequent code reviews, daily feedback, and accurate monthly calibration scorecards. The platform automatically blocks allocating a third mentee to any manager.
            </p>
          </div>
        </div>
      </div>

      {/* Manager Mentorship Status Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Manager Allocation Matrix ({managers.length} Managers)
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {managers.map((mgr) => {
            const assignedMentees = mentees.filter((m) =>
              mgr.activeMenteeIds.includes(m.id),
            );
            const isAtCapacity = mgr.activeMenteeIds.length >= 2;

            return (
              <div
                key={mgr.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {mgr.avatar?.startsWith("http") || mgr.avatar?.startsWith("/") ? (
                        <img
                          src={mgr.avatar}
                          alt={mgr.name}
                          className="size-11 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                          {mgr.avatar || mgr.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{mgr.name}</h3>
                        <p className="text-xs text-slate-500">{mgr.department}</p>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                          {mgr.track}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isAtCapacity
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {mgr.activeMenteeIds.length}/2 Mentees
                    </span>
                  </div>

                  {/* Mentee List */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Assigned Mentees:
                    </span>
                    {assignedMentees.length > 0 ? (
                      assignedMentees.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {m.avatar?.startsWith("http") || m.avatar?.startsWith("/") ? (
                              <img
                                src={m.avatar}
                                alt=""
                                className="size-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-800">
                                {m.avatar || m.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold text-slate-900">{m.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Score: {m.compositeScorePct}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-slate-400">No mentees assigned yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span
                    className={`block text-center text-xs font-semibold ${
                      isAtCapacity ? "text-slate-500" : "text-emerald-700"
                    }`}
                  >
                    {isAtCapacity ? "● At Full Capacity (2/2)" : "○ Available for 1 Mentee"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mentees Full Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">All Enrolled Mentees ({mentees.length})</h3>
            <p className="text-xs text-slate-500">Overview of mentee contact, assigned tracks, and managers</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="pb-2.5">Mentee</th>
                <th className="pb-2.5">Roll No</th>
                <th className="pb-2.5">Track</th>
                <th className="pb-2.5">Cohort</th>
                <th className="pb-2.5">Assigned Manager</th>
                <th className="pb-2.5">Score</th>
                <th className="pb-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mentees.map((mentee) => (
                <tr key={mentee.id} className="hover:bg-slate-50/50">
                  <td className="py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      {mentee.avatar?.startsWith("http") || mentee.avatar?.startsWith("/") ? (
                        <img
                          src={mentee.avatar}
                          alt=""
                          className="size-7 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-emerald-100 text-[11px] font-bold text-emerald-800">
                          {mentee.avatar || mentee.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{mentee.name}</p>
                        <p className="text-[11px] text-slate-500">{mentee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-slate-700">{mentee.rollNumber}</td>
                  <td className="py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {mentee.track}
                    </span>
                  </td>
                  <td className="py-3 text-slate-700">{mentee.cohortName}</td>
                  <td className="py-3 font-medium text-emerald-800">
                    {mentee.managerName}
                  </td>
                  <td className="py-3 font-bold text-slate-900">
                    {mentee.compositeScorePct}%
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(mentee.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Edit2 className="size-3" />
                      <span>Reassign</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mentee Pairing Modal with Strict 1:2 Validation */}
      {isPairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Assign / Reassign Mentee
                </h3>
                <p className="text-xs text-slate-500">
                  Enforces strict maximum of 2 mentees per manager
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPairingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {pairingError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{pairingError}</span>
              </div>
            )}

            <form onSubmit={handlePairSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Mentee
                </label>
                <select
                  value={selectedMenteeId}
                  onChange={(e) => {
                    setSelectedMenteeId(e.target.value);
                    setPairingError(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-900"
                >
                  {mentees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.track}) — Current: {m.managerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Manager (Max 2 Mentees)
                </label>
                <select
                  value={targetManagerId}
                  onChange={(e) => {
                    setTargetManagerId(e.target.value);
                    setPairingError(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-900"
                >
                  {managers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name} ({mgr.track}) — Currently has {mgr.activeMenteeIds.length}/2 Mentees
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPairingModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Save Manager-Mentee Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
