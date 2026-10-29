import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Globe,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  MOCK_EVIDENCE_IMAGE,
  MOCK_ID_VERIFY_IMAGE,
  mockProctoringTimeline,
  type ProctoringTimelineItem,
} from "@/lib/mockData";

type SubTab = "summary" | "timeline" | "identity" | "browser";

export function SessionDetailsPage() {
  usePageTitle("Candidate Proctoring Details");

  const [activeTab, setActiveTab] = useState<SubTab>("timeline");
  const [selectedCandidate, setSelectedCandidate] = useState("candidate01@example.com");
  const [selectedAssessment, setSelectedAssessment] = useState("Unit test 3 - Applied Concepts");
  const [evidenceModal, setEvidenceModal] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<ProctoringTimelineItem[]>(mockProctoringTimeline);

  const handleDecision = (id: string, decision: "dismiss" | "concern" | "escalate", comment: string) => {
    setTimelineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, decision, comment } : item)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Back Navigation & Candidate / Assessment Selectors */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Link
            to="/mentor/exams/ut-3/live"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text"
            aria-label="Back to live monitor"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text">Candidate Proctoring Details</h2>
            <p className="text-xs text-muted">Restricted Mentor-only telemetry & integrity review</p>
          </div>
        </div>

        {/* Selectors from Image 1 Screen 4 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Candidate:</span>
            <select
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
            >
              <option value="candidate01@example.com">candidate01@example.com (Arjun Mehta)</option>
              <option value="candidate02@example.com">candidate02@example.com (Kavya Nair)</option>
              <option value="candidate03@example.com">candidate03@example.com (Neha Kapoor)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Assessment:</span>
            <select
              value={selectedAssessment}
              onChange={(e) => setSelectedAssessment(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
            >
              <option value="Unit test 3 - Applied Concepts">Unit test 3</option>
              <option value="Unit test 2 - Foundations">Unit test 2</option>
              <option value="Unit test 1 - Basics">Unit test 1</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards matching Image 1 & Image 2: Red flags, Head glances, Eye glances, Other alerts */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Red flags */}
        <div className="rounded-xl border border-danger-500/20 bg-danger-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-danger-700">Red flags</span>
            <AlertTriangle className="size-4 text-danger-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-danger-700">1 / 3</span>
            <span className="text-[11px] text-danger-700/80">Capped limit</span>
          </div>
        </div>

        {/* Head glances */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Head glances</span>
            <RotateCcw className="size-4 text-info-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">4</span>
            <span className="text-[11px] text-muted">1-2s look-aways</span>
          </div>
        </div>

        {/* Eye glances */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Eye glances</span>
            <Eye className="size-4 text-info-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">6</span>
            <span className="text-[11px] text-muted">Gaze shifts</span>
          </div>
        </div>

        {/* Other alerts */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Other alerts</span>
            <Globe className="size-4 text-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">2</span>
            <span className="text-[11px] text-muted">Browser events</span>
          </div>
        </div>
      </div>

      {/* Subtabs Bar: Summary | Timeline | Identity | Browser Events */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {[
          { key: "summary", label: "Summary" },
          { key: "timeline", label: "Timeline" },
          { key: "identity", label: "Identity" },
          { key: "browser", label: "Browser Events" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as SubTab)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary-600 font-semibold text-primary-700"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Timeline (Primary screen shown in reference) */}
      {activeTab === "timeline" && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Telemetry Event Timeline</h3>
            <span className="text-xs text-muted">Glances, flags and browser events with evidence snapshots</span>
          </div>

          <Table>
            <THead>
              <tr>
                <TH>Time</TH>
                <TH>Event</TH>
                <TH>Direction</TH>
                <TH>Duration</TH>
                <TH>Candidate notified</TH>
                <TH>Evidence</TH>
                <TH>Review Decision</TH>
              </tr>
            </THead>
            <TBody>
              {timelineItems.map((item) => (
                <TR key={item.id} className="transition-colors hover:bg-surface-muted/50">
                  <TD className="font-mono text-xs text-text">{item.time}</TD>

                  <TD>
                    <div className="flex items-center gap-2">
                      {item.eventPill === "red_flag" ? (
                        <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
                          {item.event}
                        </span>
                      ) : item.eventPill === "glance" ? (
                        <span className="rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-info-700">
                          {item.event}
                        </span>
                      ) : (
                        <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-800">
                          {item.event}
                        </span>
                      )}
                    </div>
                  </TD>

                  <TD className="text-xs text-muted">{item.direction || "—"}</TD>
                  <TD className="text-xs font-medium text-text">{item.duration}</TD>
                  <TD className="text-xs text-muted">{item.candidateNotified}</TD>

                  {/* Evidence Snapshot Column matching Image 1 & Image 2 */}
                  <TD>
                    {item.hasEvidence ? (
                      <button
                        type="button"
                        onClick={() => setEvidenceModal(item.evidenceUrl ?? MOCK_EVIDENCE_IMAGE)}
                        className="group relative flex items-center gap-2 overflow-hidden rounded-md border border-border bg-surface-muted p-1 text-xs text-primary-700 transition-colors hover:border-primary-500"
                        title="Click to zoom evidence snapshot"
                      >
                        <img
                          src={item.evidenceUrl ?? MOCK_EVIDENCE_IMAGE}
                          alt="Webcam snapshot"
                          className="size-8 rounded object-cover shadow-2xs transition-transform group-hover:scale-105"
                        />
                        <span className="text-[11px] font-medium">Snapshot</span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </TD>

                  {/* Mentor Decision Input */}
                  <TD>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.decision || ""}
                        onChange={(e) =>
                          handleDecision(
                            item.id,
                            e.target.value as "dismiss" | "concern" | "escalate",
                            item.comment || "",
                          )
                        }
                        className="h-7 rounded border border-border bg-surface px-2 text-[11px] text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                      >
                        <option value="">No decision</option>
                        <option value="dismiss">Dismiss (benign)</option>
                        <option value="concern">Note concern</option>
                        <option value="escalate">Escalate for audit</option>
                      </select>

                      {item.decision && (
                        <span className="size-2 rounded-full bg-success-500" title="Decision recorded" />
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Tab 2: Identity Check Details */}
      {activeTab === "identity" && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Identity & Liveness Verification Record</h3>
              <p className="text-xs text-muted">Enrolled reference templates and verification check result</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
              <CheckCircle2 className="size-4" />
              Verified (Match: 94%)
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted">Liveness Verification Snapshot</span>
              <div className="overflow-hidden rounded-xl border border-border bg-surface-muted">
                <img src={MOCK_ID_VERIFY_IMAGE} alt="Liveness check preview" className="w-full object-cover" />
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg bg-surface-muted p-3 space-y-1">
                <div className="font-semibold text-text">Liveness Challenge Type: Active Blink</div>
                <div className="text-muted">Timestamp: 2025-01-15 09:58:12 IST</div>
                <div className="text-success-700">Anti-spoofing check: Passed (No screen / print detected)</div>
              </div>

              <div className="rounded-lg bg-surface-muted p-3 space-y-1">
                <div className="font-semibold text-text">Face Match Confidence: 0.94</div>
                <div className="text-muted">Cosine distance to enrolled reference: 0.12 (Threshold: 0.35)</div>
                <div className="text-muted">Algorithm: InsightFace ArcFace · 512-dim normalized vector</div>
              </div>

              <div className="rounded-lg bg-primary-50 p-3 text-primary-700">
                <strong>DPDP Privacy Guarantee:</strong> Video never leaves candidate browser. Only 3 cropped face
                snapshots and encrypted vectors are stored, auto-purged after 90 days.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Browser Events */}
      {activeTab === "browser" && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-text">Browser Integrity & Navigation Log</h3>
          <Table>
            <THead>
              <tr>
                <TH>Timestamp</TH>
                <TH>Event Type</TH>
                <TH>Severity</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <TBody>
              <TR>
                <TD className="font-mono text-xs">10:16:22</TD>
                <TD className="text-xs font-semibold text-text">Tab Switch / Blur</TD>
                <TD>
                  <span className="rounded bg-warning-50 px-2 py-0.5 text-xs text-warning-800">Medium</span>
                </TD>
                <TD className="text-xs text-muted">Browser focus lost for 1.2 seconds before returning.</TD>
              </TR>
              <TR>
                <TD className="font-mono text-xs">10:20:05</TD>
                <TD className="text-xs font-semibold text-text">Copy / Paste Attempt</TD>
                <TD>
                  <span className="rounded bg-warning-50 px-2 py-0.5 text-xs text-warning-800">Medium</span>
                </TD>
                <TD className="text-xs text-muted">Candidate attempted Ctrl+C on Question 12; clipboard access blocked.</TD>
              </TR>
            </TBody>
          </Table>
        </div>
      )}

      {/* Tab 4: Summary */}
      {activeTab === "summary" && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-text">Proctoring Assessment Overview</h3>
          <p className="text-xs text-muted">
            The candidate exhibited 1 look-away red flag (3.4 s) and 4 minor head glances. No collusion or secondary
            device detected. Assessment completed within allotted time.
          </p>
          <div className="flex gap-3">
            <Link
              to="/mentor/sessions/s1/summary"
              className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700"
            >
              Review AI Evaluation Summary
            </Link>
          </div>
        </div>
      )}

      {/* Evidence Snapshot Zoom Modal */}
      {evidenceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-text">Evidence Snapshot · 10:14:03</h4>
                <p className="text-xs text-muted">Flag 1 of 3: Look-away (3.4s) detected by head pose estimation</p>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceModal(null)}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-black">
              <img src={evidenceModal} alt="Expanded evidence capture" className="w-full object-contain" />
            </div>

            <div className="flex items-center justify-between text-xs text-muted">
              <span>Candidate: Arjun Mehta (candidate01)</span>
              <span>Encrypted at rest · Deleted after 90 days</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setEvidenceModal(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
