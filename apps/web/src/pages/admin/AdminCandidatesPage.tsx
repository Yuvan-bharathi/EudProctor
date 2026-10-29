import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Layers,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { mockCandidateBatches } from "@/lib/mockData";

export interface CandidateDetailRecord {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
  phone: string;
  department: string;
  program: string;
  semester: string;
  batchId: string;
  batchName: string;
  targetRole: string;
  verificationStatus: "Verified" | "Pending Liveness" | "Under Review";
  baselineScore: number;
  verificationDate: string;
  dpdpConsentDate: string;
  enrolledCourses: string[];
  assessmentsTaken: number;
  averageScorePct: number;
  flagsTotal: number;
  recentAssessment: {
    title: string;
    score: number;
    flags: number;
    glances: number;
    status: string;
    date: string;
  };
}

const CANDIDATES_DATA: CandidateDetailRecord[] = [
  {
    id: "u-2",
    name: "Arjun Mehta",
    rollNumber: "EP-2026-CS-042",
    email: "candidate01@example.com",
    phone: "+91 98765 43210",
    department: "Computer Science & Engineering",
    program: "B.Tech Software Engineering",
    semester: "Semester 6",
    batchId: "batch-1",
    batchName: "Batch 2026 · Campus Drive",
    targetRole: "Full Stack Engineer (SDE-1)",
    verificationStatus: "Verified",
    baselineScore: 98.4,
    verificationDate: "10 Jan 2026",
    dpdpConsentDate: "10 Jan 2026, 09:30 AM",
    enrolledCourses: ["Full Stack Development", "Frontend", "Backend"],
    assessmentsTaken: 2,
    averageScorePct: 82,
    flagsTotal: 1,
    recentAssessment: {
      title: "Unit test 1 - Basics",
      score: 78,
      flags: 1,
      glances: 10,
      status: "Mentor Approved",
      date: "15 Jan 2026",
    },
  },
  {
    id: "u-3",
    name: "Kavya Nair",
    rollNumber: "EP-2026-CS-045",
    email: "candidate02@example.com",
    phone: "+91 98765 43211",
    department: "Computer Science & Engineering",
    program: "B.Tech Software Engineering",
    semester: "Semester 6",
    batchId: "batch-1",
    batchName: "Batch 2026 · Campus Drive",
    targetRole: "Full Stack Engineer (SDE-1)",
    verificationStatus: "Verified",
    baselineScore: 99.1,
    verificationDate: "08 Jan 2026",
    dpdpConsentDate: "08 Jan 2026, 11:15 AM",
    enrolledCourses: ["Full Stack Development", "Backend"],
    assessmentsTaken: 2,
    averageScorePct: 91,
    flagsTotal: 0,
    recentAssessment: {
      title: "Unit test 1 - Basics",
      score: 91,
      flags: 0,
      glances: 2,
      status: "Mentor Approved",
      date: "15 Jan 2026",
    },
  },
  {
    id: "u-5",
    name: "Neha Kapoor",
    rollNumber: "EP-2026-CS-056",
    email: "candidate03@example.com",
    phone: "+91 98765 43213",
    department: "Computer Science & Engineering",
    program: "B.Tech Artificial Intelligence",
    semester: "Semester 6",
    batchId: "batch-1",
    batchName: "Batch 2026 · Campus Drive",
    targetRole: "Full Stack Engineer (SDE-1)",
    verificationStatus: "Under Review",
    baselineScore: 94.2,
    verificationDate: "12 Jan 2026",
    dpdpConsentDate: "12 Jan 2026, 10:20 AM",
    enrolledCourses: ["AI Engineer", "Full Stack Development"],
    assessmentsTaken: 1,
    averageScorePct: 69,
    flagsTotal: 2,
    recentAssessment: {
      title: "Unit test 2 - Foundations",
      score: 69,
      flags: 2,
      glances: 7,
      status: "Telemetry Reviewed",
      date: "14 Jan 2026",
    },
  },
  {
    id: "u-4",
    name: "Rohit Desai",
    rollNumber: "EP-2026-CS-051",
    email: "candidate04@example.com",
    phone: "+91 98765 43212",
    department: "Information Technology",
    program: "B.Tech Frontend Systems",
    semester: "Semester 6",
    batchId: "batch-2",
    batchName: "Batch 2026 · Lateral Hires",
    targetRole: "Frontend Specialist (React/TS)",
    verificationStatus: "Verified",
    baselineScore: 96.8,
    verificationDate: "11 Jan 2026",
    dpdpConsentDate: "11 Jan 2026, 08:45 AM",
    enrolledCourses: ["Frontend", "Full Stack Development"],
    assessmentsTaken: 1,
    averageScorePct: 88,
    flagsTotal: 0,
    recentAssessment: {
      title: "Unit test 2 - Foundations",
      score: 88,
      flags: 0,
      glances: 1,
      status: "Mentor Approved",
      date: "14 Jan 2026",
    },
  },
  {
    id: "u-6",
    name: "Ananya Patel",
    rollNumber: "EP-2026-CS-062",
    email: "ananya.p@college.edu",
    phone: "+91 98765 43214",
    department: "Information Technology",
    program: "B.Tech Frontend Systems",
    semester: "Semester 6",
    batchId: "batch-2",
    batchName: "Batch 2026 · Lateral Hires",
    targetRole: "Frontend Specialist (React/TS)",
    verificationStatus: "Verified",
    baselineScore: 98.7,
    verificationDate: "09 Jan 2026",
    dpdpConsentDate: "09 Jan 2026, 14:10 PM",
    enrolledCourses: ["Frontend", "Full Stack Development"],
    assessmentsTaken: 2,
    averageScorePct: 81,
    flagsTotal: 0,
    recentAssessment: {
      title: "Unit test 1 - Basics",
      score: 81,
      flags: 0,
      glances: 4,
      status: "Mentor Approved",
      date: "15 Jan 2026",
    },
  },
  {
    id: "u-7",
    name: "Vikram Singh",
    rollNumber: "EP-2026-CS-069",
    email: "vikram.s@college.edu",
    phone: "+91 98765 43215",
    department: "Data Science & Analytics",
    program: "B.Tech Data Science",
    semester: "Semester 6",
    batchId: "batch-3",
    batchName: "Batch 2025 · Data Analytics Cohort",
    targetRole: "Data Analyst & SQL Modeling",
    verificationStatus: "Pending Liveness",
    baselineScore: 91.0,
    verificationDate: "14 Jan 2026",
    dpdpConsentDate: "14 Jan 2026, 16:00 PM",
    enrolledCourses: ["Data Analyst", "Backend"],
    assessmentsTaken: 1,
    averageScorePct: 77,
    flagsTotal: 1,
    recentAssessment: {
      title: "Unit test 1 - Basics",
      score: 77,
      flags: 1,
      glances: 5,
      status: "Mentor Approved",
      date: "15 Jan 2026",
    },
  },
  {
    id: "u-8",
    name: "Devendra Joshi",
    rollNumber: "EP-2026-AI-011",
    email: "devendra.j@college.edu",
    phone: "+91 98765 43216",
    department: "Artificial Intelligence Lab",
    program: "M.Tech Intelligent Systems",
    semester: "Semester 2",
    batchId: "batch-4",
    batchName: "Batch 2026 · AI Systems Fellowship",
    targetRole: "Agentic AI & RAG Engineer",
    verificationStatus: "Verified",
    baselineScore: 99.4,
    verificationDate: "15 Jan 2026",
    dpdpConsentDate: "15 Jan 2026, 11:00 AM",
    enrolledCourses: ["AI Engineer", "Backend"],
    assessmentsTaken: 1,
    averageScorePct: 94,
    flagsTotal: 0,
    recentAssessment: {
      title: "Final - Agentic AI & RAG Systems",
      score: 94,
      flags: 0,
      glances: 1,
      status: "Mentor Approved",
      date: "18 Jan 2026",
    },
  },
  {
    id: "u-9",
    name: "Priya Nair",
    rollNumber: "EP-2026-AI-019",
    email: "priya.nair@college.edu",
    phone: "+91 98765 43217",
    department: "Artificial Intelligence Lab",
    program: "M.Tech Intelligent Systems",
    semester: "Semester 2",
    batchId: "batch-4",
    batchName: "Batch 2026 · AI Systems Fellowship",
    targetRole: "Agentic AI & RAG Engineer",
    verificationStatus: "Verified",
    baselineScore: 97.9,
    verificationDate: "15 Jan 2026",
    dpdpConsentDate: "15 Jan 2026, 11:30 AM",
    enrolledCourses: ["AI Engineer", "Full Stack Development"],
    assessmentsTaken: 1,
    averageScorePct: 89,
    flagsTotal: 0,
    recentAssessment: {
      title: "Final - Agentic AI & RAG Systems",
      score: 89,
      flags: 0,
      glances: 2,
      status: "Mentor Approved",
      date: "18 Jan 2026",
    },
  },
];

export function AdminCandidatesPage() {
  usePageTitle("Candidate Batches & Screening Directory · Admin");

  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "flagged">("all");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetailRecord | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  // Active batch object
  const activeBatch = useMemo(() => {
    if (selectedBatchId === "all") return null;
    return mockCandidateBatches.find((b) => b.id === selectedBatchId) || null;
  }, [selectedBatchId]);

  // Filtered candidate records
  const filteredCandidates = useMemo(() => {
    return CANDIDATES_DATA.filter((c) => {
      // 1. Batch filter
      if (selectedBatchId !== "all" && c.batchId !== selectedBatchId) {
        return false;
      }

      // 2. Search query (name, email, roll, phone, target role, department)
      const q = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.rollNumber.toLowerCase().includes(q) ||
        c.targetRole.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 3. Status filter
      if (statusFilter === "verified") return c.verificationStatus === "Verified";
      if (statusFilter === "flagged") return c.flagsTotal > 0;
      return true;
    });
  }, [selectedBatchId, search, statusFilter]);

  const handleActionToast = (msg: string) => {
    setAuditMessage(msg);
    setTimeout(() => setAuditMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-text">Candidate Directory & Batches</h2>
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 border border-primary-200/50">
              Interview Screening Roster
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Organized batch-wise candidate screening registry with mobile contact numbers, identity verification, and proctoring telemetry audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleActionToast("Exported all candidate biometric audit logs and contact numbers to CSV.")}
            className="gap-1.5 text-xs text-muted hover:text-text border-border shadow-2xs"
          >
            <Download className="size-3.5" />
            <span>Export Batch Dossier</span>
          </Button>
        </div>
      </div>

      {auditMessage && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 px-4 py-2.5 text-xs font-semibold text-success-800 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success-600" />
            {auditMessage}
          </span>
          <button type="button" onClick={() => setAuditMessage(null)} className="text-success-800">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: BATCH-WISE SELECTION CARDS (CLICK TO FILTER CANDIDATES) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary-600" />
            <span>Select Candidate Batch</span>
          </span>
          <span className="text-[11px] text-muted">
            Click any cohort to view batch candidate roster & telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 0: All Batches */}
          <button
            type="button"
            onClick={() => setSelectedBatchId("all")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedBatchId === "all"
                ? "border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/30 shadow-xs"
                : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted/30 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-muted">ALL-COHORTS</span>
              <span className={`size-2 rounded-full ${selectedBatchId === "all" ? "bg-primary-600" : "bg-muted"}`} />
            </div>
            <div className="mt-1.5 text-xs font-bold text-text truncate">All Batches</div>
            <div className="mt-1 text-[11px] text-muted">Across all recruitment drives</div>
            <div className="mt-2.5 flex items-center justify-between text-xs font-semibold">
              <span className="text-primary-700">{CANDIDATES_DATA.length} Candidates</span>
              <span className="text-muted">84% Avg</span>
            </div>
          </button>

          {/* Cards 1 to 4: Real Batches */}
          {mockCandidateBatches.map((batch) => {
            const isSelected = selectedBatchId === batch.id;
            const batchCandidatesCount = CANDIDATES_DATA.filter((c) => c.batchId === batch.id).length;

            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => setSelectedBatchId(batch.id)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/30 shadow-xs"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted/30 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-muted">{batch.code}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                      batch.status === "Active"
                        ? "bg-success-50 text-success-700"
                        : "bg-info-50 text-info-700"
                    }`}
                  >
                    {batch.status}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-text truncate" title={batch.name}>
                  {batch.name}
                </div>
                <div className="mt-0.5 text-[11px] text-muted truncate" title={batch.targetRole}>
                  {batch.targetRole}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs font-semibold border-t border-border/60 pt-2">
                  <span className="text-primary-700">{batchCandidatesCount} Enrolled</span>
                  <span className="text-text font-bold">{batch.completionRate}% Done</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Batch Active Summary Banner */}
      {activeBatch && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-50/40 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text">{activeBatch.name}</span>
              <span className="rounded bg-primary-100 px-2 py-0.5 font-mono text-[10px] font-bold text-primary-800">
                {activeBatch.code}
              </span>
            </div>
            <p className="text-xs text-muted">
              Target Role: <strong>{activeBatch.targetRole}</strong> • Active Screening: <strong>{activeBatch.activeScreening}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted block text-[10px] uppercase">Hiring Lead</span>
              <span className="font-semibold text-text">{activeBatch.hiringManager}</span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase">Completion</span>
              <span className="font-bold text-success-700">{activeBatch.completionRate}% Verified</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedBatchId("all")}
              className="text-xs border-border text-muted hover:text-text h-7"
            >
              Clear Filter
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 2: SEARCH, FILTERS & ACTION BAR */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search candidates by name, roll no, mobile, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All Candidates" },
            { key: "verified", label: "Verified Biometrics" },
            { key: "flagged", label: "With Flag History" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? "bg-primary-50 text-primary-700 shadow-2xs font-bold"
                  : "text-muted hover:bg-surface-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3: CANDIDATES TABLE WITH MOBILE NUMBERS */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
        {filteredCandidates.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No candidates found matching the selected batch and search criteria.
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Candidate & Roll No</TH>
                <TH>Contact & Mobile</TH>
                <TH>Batch & Target Role</TH>
                <TH>Identity Status</TH>
                <TH>Screening GPA</TH>
                <TH>Integrity Record</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </THead>
            <TBody>
              {filteredCandidates.map((c) => {
                const isVerified = c.verificationStatus === "Verified";

                return (
                  <TR key={c.id} className="transition-colors hover:bg-surface-muted/40">
                    {/* Candidate Name & Avatar */}
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          {c.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-text">{c.name}</div>
                          <div className="font-mono text-[11px] text-muted">{c.rollNumber}</div>
                        </div>
                      </div>
                    </TD>

                    {/* Contact Email & Mobile Number with Icon */}
                    <TD>
                      <div className="space-y-0.5">
                        <div className="font-mono text-xs text-text">{c.email}</div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                          <Phone className="size-3 text-primary-600 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      </div>
                    </TD>

                    {/* Batch & Target Role */}
                    <TD>
                      <div className="space-y-1">
                        <span className="inline-block rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text border border-border">
                          {c.batchName}
                        </span>
                        <div className="text-[11px] text-muted truncate max-w-[180px]">
                          {c.targetRole}
                        </div>
                      </div>
                    </TD>

                    {/* Identity Verification */}
                    <TD>
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-semibold text-success-700">
                          <CheckCircle2 className="size-3" />
                          Verified ({c.baselineScore}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-[11px] font-semibold text-warning-800">
                          <Clock className="size-3" />
                          {c.verificationStatus}
                        </span>
                      )}
                    </TD>

                    {/* Assessments & GPA */}
                    <TD>
                      <div className="text-xs font-bold text-text">{c.averageScorePct}% Avg</div>
                      <div className="text-[11px] text-muted">{c.assessmentsTaken} evaluation(s)</div>
                    </TD>

                    {/* Integrity Record (Flags Capped at 3) */}
                    <TD>
                      {c.flagsTotal > 0 ? (
                        <Badge tone="warning" className="gap-1 font-medium">
                          <AlertTriangle className="size-3" />
                          {c.flagsTotal} / 3 Capped Flag
                        </Badge>
                      ) : (
                        <Badge tone="success" className="gap-1 font-medium">
                          <CheckCircle2 className="size-3" />
                          Clean Record
                        </Badge>
                      )}
                    </TD>

                    {/* Action */}
                    <TD className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedCandidate(c)}
                        className="gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 border-border"
                      >
                        <Eye className="size-3.5" />
                        <span>View Details</span>
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {/* Candidate Details Drilldown Modal with Mobile Number and Batch Details */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-lg font-bold text-primary-700">
                  {selectedCandidate.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text">{selectedCandidate.name}</h3>
                    <Badge tone="success">Screening Active</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono font-semibold text-text">{selectedCandidate.rollNumber}</span>
                    <span>•</span>
                    <span>{selectedCandidate.batchName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Candidate Metadata Summary */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/30 p-4 sm:grid-cols-4 text-xs">
              <div>
                <div className="text-muted">Email Address</div>
                <div className="font-mono font-medium text-text truncate">{selectedCandidate.email}</div>
              </div>
              <div>
                <div className="text-muted">Contact Mobile</div>
                <div className="font-mono font-semibold text-text flex items-center gap-1">
                  <Phone className="size-3 text-primary-600" />
                  <span>{selectedCandidate.phone}</span>
                </div>
              </div>
              <div>
                <div className="text-muted">Target Role</div>
                <div className="font-medium text-text">{selectedCandidate.targetRole}</div>
              </div>
              <div>
                <div className="text-muted">Academic Standing</div>
                <div className="font-bold text-success-700">{selectedCandidate.averageScorePct}% Avg Score</div>
              </div>
            </div>

            {/* Biometric Verification & DPDP Compliance Section */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <ShieldCheck className="size-4 text-primary-600" />
                <span>Biometric Baseline & DPDP Consent Status</span>
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">Face Baseline & Liveness</span>
                    <Badge tone="success">{selectedCandidate.baselineScore}% Confidence</Badge>
                  </div>
                  <p className="text-muted">
                    Verified on {selectedCandidate.verificationDate}. 3D rotational head check and neutral gaze calibrated.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">DPDP Act Compliance</span>
                    <Badge tone="primary">Consent Active</Badge>
                  </div>
                  <p className="text-muted">
                    Consent timestamped on {selectedCandidate.dpdpConsentDate}. Telemetry retained 90 days.
                  </p>
                </div>
              </div>
            </div>

            {/* Assessment Performance & Integrity History */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <Award className="size-4 text-primary-600" />
                <span>Recent Screening Assessment & Proctoring Telemetry</span>
              </h4>

              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-text">{selectedCandidate.recentAssessment.title}</div>
                    <div className="text-[11px] text-muted">{selectedCandidate.targetRole} · {selectedCandidate.recentAssessment.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-success-700">{selectedCandidate.recentAssessment.score}%</div>
                    <div className="text-[11px] text-muted">{selectedCandidate.recentAssessment.status}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <span className="text-muted">Red Flags:</span>{" "}
                    <span className="font-semibold text-text">{selectedCandidate.recentAssessment.flags} / 3 Capped</span>
                  </div>
                  <div>
                    <span className="text-muted">Glance Events:</span>{" "}
                    <span className="font-semibold text-text">{selectedCandidate.recentAssessment.glances} detected</span>
                  </div>
                  <div>
                    <span className="text-muted">Disqualification:</span>{" "}
                    <span className="font-semibold text-success-700">None (Clean)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Administrative Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleActionToast(`Re-verification link dispatched to ${selectedCandidate.phone} and ${selectedCandidate.email}`);
                    setSelectedCandidate(null);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Baseline</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleActionToast(`Exported DPDP audit dossier for ${selectedCandidate.name}`);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Download className="size-3.5" />
                  <span>Download Dossier</span>
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCandidate(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
