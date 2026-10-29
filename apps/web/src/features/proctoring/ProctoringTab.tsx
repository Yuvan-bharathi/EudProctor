/**
 * Proctoring tab of the assessment workspace (mentor only).
 *
 * One card per candidate with their proctoring summary; a dropdown expands the full timeline with evidence and
 * review decisions. "Live Cam" opens a live camera-status view for candidates who are taking the assessment now.
 * It shows what the browser reports in real time (looking at the screen or away, direction, duration, camera
 * problems). No video is shown: video never leaves the candidate's browser (CLAUDE.md rule 6).
 *
 * Real data comes from the API; when an assessment has no sessions yet the workspace's sample data is shown,
 * clearly labelled.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GlanceChip, RedFlagChip, SeverityBadge, type LookSource } from "@/components/ProctorChips";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { authStore } from "@/features/auth/store";
import { API_BASE, api, errorMessage } from "@/lib/api";
import { type LiveCandidateRow, mockLiveCandidates, mockProctoringTimeline } from "@/lib/mockData";
import type { Assignment } from "@/lib/types";
import { cn, formatClock, formatDuration } from "@/lib/utils";
import { eventLabel } from "@/pages/mentor/eventLabels";

// ---------- types ----------
interface LiveRow {
  session_id: string;
  candidate_id: string;
  candidate_name: string;
  status: string;
  flag_count: number;
  max_flags: number;
  flag_limit_reached: boolean;
  head_glances: number;
  eye_glances: number;
  other_alerts: number;
  high_alerts: number;
  open_identity_reviews: number;
}

interface TimelineItem {
  id: string;
  item_type: "event" | "glance";
  kind: "red_flag" | "post_limit" | "glance" | "alert";
  type: string;
  severity: "high" | "medium" | "low";
  flag_no: number | null;
  source: LookSource | null;
  direction: string | null;
  started_at: string;
  exam_clock_ms: number | null;
  duration_ms: number;
  candidate_notified: boolean;
  has_evidence: boolean;
  decision: "dismiss" | "concern" | "escalate" | null;
  decision_comment: string | null;
}

interface SessionDetails {
  summary: { red_flags: number; max_flags: number; post_limit: number; head_glances: number; eye_glances: number; other_alerts: number };
  timeline: TimelineItem[];
}

interface LiveAlert {
  kind: "red_flag" | "post_limit" | "glance" | "alert" | "look_away_ongoing";
  session_id: string;
  at?: string;
  flag_no?: number | null;
  source?: LookSource;
  direction?: string;
  duration_ms?: number;
  type?: string;
  severity?: "high" | "medium" | "low";
}

/** Normalised card data for both real and sample rows. */
interface CandidateCard {
  key: string;
  sessionId: string | null;
  name: string;
  email: string;
  status: "live" | "submitted" | "not_started" | "identity" | "closed";
  statusLabel: string;
  flags: number;
  maxFlags: number;
  limitReached: boolean;
  headGlances: number;
  eyeGlances: number;
  otherAlerts: number;
  highAlerts: number;
  identityReviews: number;
  sample?: LiveCandidateRow;
}

const LIVE = new Set(["in_progress"]);
const DONE = new Set(["submitted", "scored", "analysed"]);
const IDENTITY = new Set(["link_opened", "identity_check", "identity_review", "calibrating"]);

function fromLive(r: LiveRow, emails: Map<string, string>): CandidateCard {
  const status = LIVE.has(r.status) ? "live" : DONE.has(r.status) ? "submitted" : IDENTITY.has(r.status) ? "identity" : "closed";
  const label = { live: "Taking the assessment", submitted: "Submitted", identity: "Verifying identity", closed: r.status.replace(/_/g, " "), not_started: "Not started" }[status];
  return {
    key: r.session_id, sessionId: r.session_id, name: r.candidate_name, email: emails.get(r.candidate_id) ?? "", status, statusLabel: label,
    flags: r.flag_count, maxFlags: r.max_flags, limitReached: r.flag_limit_reached, headGlances: r.head_glances, eyeGlances: r.eye_glances,
    otherAlerts: r.other_alerts, highAlerts: r.high_alerts, identityReviews: r.open_identity_reviews,
  };
}

function fromSample(r: LiveCandidateRow): CandidateCard {
  const status = r.status === "In progress" ? "live" : r.status === "Completed" ? "submitted" : "not_started";
  return {
    key: r.id, sessionId: null, name: r.name, email: r.email, status, statusLabel: r.status === "In progress" ? "Taking the assessment" : r.status,
    flags: r.flags, maxFlags: r.maxFlags, limitReached: false, headGlances: r.flags + 2, eyeGlances: r.isGlancing ? 4 : 1,
    otherAlerts: r.status === "Not started" ? 0 : 1, highAlerts: 0, identityReviews: 0, sample: r,
  };
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// ---------- live updates over the mentor WebSocket (single-use ticket, no token in the URL) ----------
function useLiveAlerts(examId: string, enabled: boolean, onAlert: (a: LiveAlert) => void) {
  const [connected, setConnected] = useState(false);
  const cb = useRef(onAlert);
  cb.current = onAlert;
  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = async () => {
      try {
        const { ticket } = await api<{ ticket: string }>(`/mentor/exams/${examId}/ws-ticket`, { method: "POST" });
        if (closed) return;
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}${API_BASE}/ws/mentor/exams/${examId}?ticket=${encodeURIComponent(ticket)}`);
        ws.onopen = () => setConnected(true);
        ws.onmessage = (e) => cb.current(JSON.parse(e.data) as LiveAlert);
        ws.onclose = () => {
          setConnected(false);
          if (!closed) retry = setTimeout(connect, 3000);
        };
      } catch {
        if (!closed) retry = setTimeout(connect, 5000);
      }
    };
    void connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [examId, enabled]);
  return connected;
}

// ---------- expanded details ----------
function EvidenceButton({ eventId }: { eventId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  async function open() {
    try {
      const r = await fetch(`${API_BASE}/mentor/evidence/${eventId}`, { headers: { Authorization: `Bearer ${authStore.get()?.access_token ?? ""}` } });
      if (!r.ok) throw new Error();
      setUrl(URL.createObjectURL(await r.blob()));
    } catch {
      setFailed(true);
    }
  }
  if (failed) return <span className="text-xs text-muted">Unavailable</span>;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={open} aria-label="View evidence snapshot">
        <ImageIcon aria-hidden="true" /> View
      </Button>
      {url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4" role="dialog" aria-modal="true" aria-label="Evidence snapshot">
          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                autoFocus
                onClick={() => {
                  URL.revokeObjectURL(url);
                  setUrl(null);
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <img src={url} alt="Evidence snapshot" className="max-h-[70vh] rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}

function DecisionCell({ item, sessionId, examId }: { item: TimelineItem; sessionId: string; examId: string }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState(item.decision ?? "");
  const [comment, setComment] = useState(item.decision_comment ?? "");
  const save = useMutation({
    mutationFn: () => api(`/mentor/flags/${item.id}/review`, { body: { item_type: item.item_type, decision, comment } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proctoring-details", sessionId] });
      qc.invalidateQueries({ queryKey: ["live", examId] });
    },
  });
  const dirty = decision !== (item.decision ?? "") || comment !== (item.decision_comment ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Review decision" value={decision} onChange={(e) => setDecision(e.target.value)} className="h-8 text-xs">
        <option value="">No decision</option>
        <option value="dismiss">Dismiss</option>
        <option value="concern">Note concern</option>
        <option value="escalate">Escalate</option>
      </Select>
      <Input aria-label="Comment" placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} className="h-8 w-36 text-xs" />
      {dirty && decision && (
        <Button size="sm" variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
          Save
        </Button>
      )}
      {save.isError && <span className="text-xs text-danger-700">{errorMessage(save.error)}</span>}
    </div>
  );
}

function EventCell({ item }: { item: TimelineItem }) {
  if (item.kind === "glance") return <GlanceChip source={item.source ?? "head"} />;
  if (item.kind === "red_flag" || item.kind === "post_limit") return <RedFlagChip flagNo={item.flag_no} max={3} source={item.source ?? undefined} />;
  return (
    <span className="inline-flex items-center gap-2">
      <SeverityBadge severity={item.severity} />
      <span>{eventLabel(item.type)}</span>
    </span>
  );
}

function RealDetails({ sessionId, examId }: { sessionId: string; examId: string }) {
  const q = useQuery({ queryKey: ["proctoring-details", sessionId], queryFn: () => api<SessionDetails>(`/mentor/sessions/${sessionId}/details`) });
  if (q.isPending) return <LoadingState rows={3} label="Loading proctoring details" />;
  if (q.isError) return <ErrorState message="Could not load proctoring details." onRetry={() => q.refetch()} />;
  const items = q.data.timeline;
  if (items.length === 0)
    return <p className="flex items-center gap-2 text-sm text-text"><ShieldCheck className="size-4 text-success-700" aria-hidden="true" /> Nothing recorded for this candidate.</p>;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Time</TH>
          <TH>Event</TH>
          <TH>Direction</TH>
          <TH>Duration</TH>
          <TH>Candidate notified</TH>
          <TH>Evidence</TH>
          <TH>Review decision</TH>
        </tr>
      </THead>
      <TBody>
        {items.map((i) => (
          <TR key={i.id}>
            <TD className="font-mono text-[13px]">
              {i.exam_clock_ms !== null ? formatClock(i.exam_clock_ms) : new Date(i.started_at).toLocaleTimeString()}
            </TD>
            <TD><EventCell item={i} /></TD>
            <TD className="capitalize">{i.direction ?? "—"}</TD>
            <TD>{i.duration_ms ? formatDuration(i.duration_ms) : "—"}</TD>
            <TD>{i.candidate_notified ? "Yes" : "No"}</TD>
            <TD>{i.has_evidence && i.item_type === "event" ? <EvidenceButton eventId={i.id} /> : "—"}</TD>
            <TD><DecisionCell item={i} sessionId={sessionId} examId={examId} /></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

const SAMPLE_PILL: Record<string, string> = {
  glance: "bg-info-50 text-info-700",
  red_flag: "bg-danger-50 text-danger-700",
  alert: "bg-warning-50 text-warning-800",
  blocked: "bg-warning-50 text-warning-800",
};

function SampleDetails() {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Time</TH>
          <TH>Event</TH>
          <TH>Direction</TH>
          <TH>Duration</TH>
          <TH>Candidate notified</TH>
          <TH>Review decision</TH>
        </tr>
      </THead>
      <TBody>
        {mockProctoringTimeline.map((i) => (
          <TR key={i.id}>
            <TD className="font-mono text-[13px]">{i.time}</TD>
            <TD>
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", SAMPLE_PILL[i.eventPill])}>{i.event}</span>
            </TD>
            <TD>{i.direction ?? "—"}</TD>
            <TD>{i.duration}</TD>
            <TD>{i.candidateNotified}</TD>
            <TD className="capitalize text-muted">{i.decision ?? "No decision"}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

// ---------- Live Cam: live camera status (no video) ----------
interface LiveState {
  away?: { source?: LookSource; direction?: string; duration_ms?: number; at: number };
  recent: LiveAlert[];
  cameraIssue?: boolean;
}

function LiveCamPanel({ card, state, connected, onClose }: { card: CandidateCard; state: LiveState | undefined; connected: boolean; onClose: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sample = card.sample;
  // an ongoing look-away is reported about once a second; if updates stop, the candidate is back on screen
  const away = state?.away && Date.now() - state.away.at < 2500 ? state.away : null;
  const sampleAway = sample?.isGlancing ? (sample.glanceDetail ?? "").replace(/^looking away\s*/i, "") : null;
  const lookingAway = Boolean(away || sampleAway);
  const camera = state?.cameraIssue ? "issue" : "ok";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4" role="dialog" aria-modal="true" aria-labelledby="livecam-title">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="livecam-title" className="text-base font-semibold text-text">Live Cam · {card.name}</h3>
            <p className="text-xs text-muted">{connected || sample ? "Updating live" : "Connecting…"}{sample && " · sample data"}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close live view" onClick={onClose} autoFocus>
            <X aria-hidden="true" />
          </Button>
        </div>

        <div
          className={cn(
            "flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border text-center",
            lookingAway ? "border-warning-500/40 bg-warning-50" : "border-border bg-surface-muted",
          )}
          role="status"
          aria-live="polite"
        >
          {camera === "issue" ? (
            <>
              <CameraOff className="size-10 text-danger-700" aria-hidden="true" />
              <p className="text-sm font-medium text-danger-700">Camera unavailable on the candidate's device</p>
            </>
          ) : lookingAway ? (
            <>
              <EyeOff className="size-10 text-warning-800" aria-hidden="true" />
              <p className="text-sm font-medium text-warning-800">
                {away
                  ? `Looking away${away.direction ? ` (${away.direction})` : ""} · ${formatDuration(away.duration_ms ?? 0)}${away.source ? ` · ${away.source}` : ""}`
                  : `Looking away${sampleAway ? ` · ${sampleAway}` : ""}`}
              </p>
            </>
          ) : card.status === "live" ? (
            <>
              <Eye className="size-10 text-success-700" aria-hidden="true" />
              <p className="text-sm font-medium text-success-700">Camera on · looking at the screen</p>
            </>
          ) : (
            <>
              <Camera className="size-10 text-muted" aria-hidden="true" />
              <p className="text-sm text-muted">The candidate is not taking the assessment right now.</p>
            </>
          )}
          <p className="max-w-sm px-4 text-xs text-muted">
            Video stays on the candidate's device. This view shows what their browser reports in real time; evidence snapshots of red
            flags are in the timeline.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-lg bg-surface-muted p-2">
            <div className="text-muted">Red flags</div>
            <div className={cn("text-lg font-semibold", card.flags ? "text-danger-700" : "text-text")}>{card.flags} / {card.maxFlags}</div>
          </div>
          <div className="rounded-lg bg-surface-muted p-2">
            <div className="text-muted">Glances</div>
            <div className="text-lg font-semibold text-text">{card.headGlances + card.eyeGlances}</div>
          </div>
          <div className="rounded-lg bg-surface-muted p-2">
            <div className="text-muted">Other alerts</div>
            <div className="text-lg font-semibold text-text">{card.otherAlerts}</div>
          </div>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Latest activity</h4>
          {state?.recent.length ? (
            <ul className="space-y-1 text-sm">
              {state.recent.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">{a.at ? new Date(a.at).toLocaleTimeString() : ""}</span>
                  {a.kind === "glance" ? (
                    <GlanceChip source={a.source ?? "head"} durationMs={a.duration_ms} />
                  ) : a.kind === "red_flag" || a.kind === "post_limit" ? (
                    <RedFlagChip flagNo={a.flag_no ?? null} max={card.maxFlags} source={a.source} />
                  ) : (
                    <span className="text-text">{eventLabel(a.type ?? "")}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing new since you opened this view.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- card ----------
const statusBadge: Record<CandidateCard["status"], "success" | "primary" | "warning" | "neutral"> = {
  live: "success",
  submitted: "primary",
  identity: "warning",
  not_started: "neutral",
  closed: "neutral",
};

function CandidateProctoringCard({
  card,
  examId,
  open,
  onToggle,
  onLiveCam,
  live,
}: {
  card: CandidateCard;
  examId: string;
  open: boolean;
  onToggle: () => void;
  onLiveCam: () => void;
  live: LiveState | undefined;
}) {
  const panelId = `proctoring-${card.key}`;
  const awayNow = live?.away && Date.now() - live.away.at < 2500;
  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700" aria-hidden="true">
          {initials(card.name)}
        </span>
        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text">{card.name}</span>
            <Badge tone={statusBadge[card.status]}>
              {card.status === "live" && <Radio aria-hidden="true" />}
              {card.statusLabel}
            </Badge>
            {awayNow && <Badge tone="warning">Looking away now</Badge>}
          </div>
          {card.email && <div className="text-xs text-muted">{card.email}</div>}
        </div>
        <dl className="flex flex-wrap gap-2 text-xs">
          <div className={cn("rounded-lg px-2.5 py-1", card.flags ? "bg-danger-50 text-danger-700" : "bg-surface-muted text-text")}>
            <dt className="inline">Red flags </dt>
            <dd className="inline font-semibold">{card.flags} / {card.maxFlags}</dd>
          </div>
          <div className="rounded-lg bg-info-50 px-2.5 py-1 text-info-700">
            <dt className="inline">Head glances </dt>
            <dd className="inline font-semibold">{card.headGlances}</dd>
          </div>
          <div className="rounded-lg bg-info-50 px-2.5 py-1 text-info-700">
            <dt className="inline">Eye glances </dt>
            <dd className="inline font-semibold">{card.eyeGlances}</dd>
          </div>
          <div className="rounded-lg bg-surface-muted px-2.5 py-1 text-text">
            <dt className="inline">Other alerts </dt>
            <dd className="inline font-semibold">{card.otherAlerts}</dd>
          </div>
          {card.limitReached && <Badge tone="danger">Flag limit reached</Badge>}
          {card.identityReviews > 0 && <Badge tone="warning"><AlertTriangle aria-hidden="true" /> Identity review</Badge>}
        </dl>
        <div className="flex items-center gap-2">
          {card.status === "live" && (
            <Button size="sm" variant="secondary" onClick={onLiveCam}>
              <Camera aria-hidden="true" /> Live Cam
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
            Details
            <ChevronDown className={cn("transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-border p-4">
          {card.sessionId ? <RealDetails sessionId={card.sessionId} examId={examId} /> : <SampleDetails />}
          {card.sessionId && (
            <Link to={`/mentor/sessions/${card.sessionId}`} className="inline-block text-sm text-primary-700 underline underline-offset-2">
              Open full proctoring page
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

// ---------- tab ----------
const ORDER: Record<CandidateCard["status"], number> = { live: 0, identity: 1, submitted: 2, not_started: 3, closed: 4 };

export function ProctoringTab({ examId, assignments }: { examId: string; assignments: Assignment[] }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["live", examId], queryFn: () => api<LiveRow[]>(`/mentor/exams/${examId}/live`), retry: false });
  const real = (q.data?.length ?? 0) > 0;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [liveCam, setLiveCam] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onAlert = useCallback(
    (a: LiveAlert) => {
      setLive((s) => {
        const cur = s[a.session_id] ?? { recent: [] };
        if (a.kind === "look_away_ongoing") {
          return { ...s, [a.session_id]: { ...cur, away: { source: a.source, direction: a.direction, duration_ms: a.duration_ms, at: Date.now() } } };
        }
        return {
          ...s,
          [a.session_id]: {
            ...cur,
            away: undefined,
            cameraIssue: cur.cameraIssue || a.type === "CAMERA_UNAVAILABLE",
            recent: [a, ...cur.recent].slice(0, 5),
          },
        };
      });
      if (a.kind !== "look_away_ongoing") {
        if (refresh.current) clearTimeout(refresh.current);
        refresh.current = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["live", examId] });
          qc.invalidateQueries({ queryKey: ["proctoring-details", a.session_id] });
        }, 400);
      }
    },
    [examId, qc],
  );
  const connected = useLiveAlerts(examId, real, onAlert);

  if (q.isPending) return <LoadingState rows={4} label="Loading candidates" />;

  const emails = new Map(assignments.map((a) => [a.candidate_id, a.candidate_email]));
  const cards = (real ? q.data!.map((r) => fromLive(r, emails)) : mockLiveCandidates.map(fromSample)).sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
  const liveCount = cards.filter((c) => c.status === "live").length;
  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const camCard = cards.find((c) => c.key === liveCam);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Proctoring</h2>
          <p className="text-xs text-muted">
            {cards.length} candidate{cards.length === 1 ? "" : "s"} · {liveCount} taking the assessment now. Glances, timelines and evidence are
            visible to mentors only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!real && <Badge tone="warning">Sample data · no candidate has opened this assessment yet</Badge>}
          {real && (
            <span className="flex items-center gap-1.5 text-xs text-muted" role="status">
              <Radio className="size-4" aria-hidden="true" /> {connected ? "Live" : "Connecting…"}
            </span>
          )}
          {cards.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(open.size ? new Set() : new Set(cards.map((c) => c.key)))}>
              {open.size ? "Collapse all" : "Expand all"}
            </Button>
          )}
        </div>
      </div>
      {cards.length === 0 ? (
        <EmptyState message="No candidates yet. Assign candidates and send their links first." />
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <CandidateProctoringCard
              key={c.key}
              card={c}
              examId={examId}
              open={open.has(c.key)}
              onToggle={() => toggle(c.key)}
              onLiveCam={() => setLiveCam(c.key)}
              live={live[c.key]}
            />
          ))}
        </ul>
      )}
      {camCard && <LiveCamPanel card={camCard} state={live[camCard.key]} connected={connected} onClose={() => setLiveCam(null)} />}
    </div>
  );
}
