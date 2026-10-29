import { classify } from "./classify";
import type { ClientEvent, ProctoringConfig } from "./config";
import { type LookState, ongoingMs, step } from "./lookAway";
import { autoCalibration, awayFrom, type Calibration, type FrameSignals, Smoother } from "./signals";

export interface MonitorHooks {
  emit: (ev: ClientEvent) => void;
  /** Optimistic candidate notice; the server count re-syncs afterwards. */
  notice: (flagNo: number) => void;
  /** Small JPEG (base64) of the current frame, for red-flag evidence only. */
  snapshot: () => string | null;
  flagCount: () => number;
}

const PROGRESS_EVERY_MS = 1000;

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Turns frame signals into proctoring events. It has no access to the session: it can only emit events and
 * show the neutral notice. It never pauses, blocks or submits anything (CLAUDE.md rule 1).
 */
export class ProctorMonitor {
  private state: LookState = { phase: "on" };
  private smoother = new Smoother();
  private calibration: Calibration | null;
  private warmup: FrameSignals[] = [];
  private noticed = false;
  private optimistic = 0;
  private snapshot: string | null = null;
  private lookId = newId();
  private lastProgress = 0;
  private absentSince: number | null = null;
  private multiSince: number | null = null;
  private multiSnapshot: string | null = null;

  constructor(
    private cfg: ProctoringConfig,
    calibration: Calibration | null,
    private examStartMs: number,
    private hooks: MonitorHooks,
  ) {
    this.calibration = calibration;
  }

  private clock(t: number) {
    return Math.max(0, t - this.examStartMs);
  }

  onSignals(raw: FrameSignals) {
    const s = this.smoother.push(raw);
    const now = s.t;
    this.trackFaces(s, now);

    if (!this.calibration) {
      this.warmup.push(s);
      this.calibration = autoCalibration(this.warmup);
      return;
    }

    // with no face visible we cannot judge gaze: keep an ongoing look-away going, otherwise wait
    let away = false;
    let source: "head" | "eyes" = "head";
    let direction: "left" | "right" | "up" | "down" = "left";
    if (s.faces === 1) {
      ({ away, source, direction } = awayFrom(s, this.calibration, this.cfg));
    } else if (s.faces === 0 && this.state.phase === "away") {
      away = true;
      ({ source, direction } = this.state);
    } else if (s.faces > 1) {
      return; // multiple faces is reported separately
    }

    const [next, ended] = step(this.state, now, away, source, direction, this.cfg);
    this.state = next;

    const ongoing = ongoingMs(this.state, now);
    if (this.state.phase === "away") {
      if (!this.noticed && ongoing >= this.cfg.flag_threshold_s * 1000) {
        // notice as soon as the threshold is crossed; the event is finalised with the full duration later
        this.noticed = true;
        this.snapshot = this.hooks.snapshot();
        const count = Math.max(this.hooks.flagCount(), this.optimistic);
        if (classify(ongoing, count, this.cfg) === "flag") {
          this.optimistic = count + 1;
          this.hooks.notice(this.optimistic);
        }
      }
      if (ongoing >= this.cfg.glance_min_s * 1000 && now - this.lastProgress >= PROGRESS_EVERY_MS) {
        this.lastProgress = now;
        this.hooks.emit({
          client_event_id: this.lookId,
          type: "LOOK_AWAY_PROGRESS",
          source: this.state.source,
          direction: this.state.direction,
          started_at: new Date(this.state.since).toISOString(),
          duration_ms: ongoing,
        });
      }
    }

    if (ended) {
      const ev: ClientEvent = {
        client_event_id: this.lookId,
        type: "LOOK_AWAY",
        source: ended.source,
        direction: ended.direction,
        started_at: new Date(ended.startedAt).toISOString(),
        duration_ms: ended.durationMs,
        exam_clock_ms: this.clock(ended.startedAt),
      };
      if (this.snapshot && ended.durationMs >= this.cfg.flag_threshold_s * 1000) ev.snapshot_b64 = this.snapshot;
      this.hooks.emit(ev);
      this.lookId = newId();
      this.noticed = false;
      this.snapshot = null;
    } else if (this.state.phase === "on") {
      this.noticed = false;
      this.snapshot = null;
    }
  }

  /** Server count is the truth; keep the optimistic counter from running ahead of it. */
  syncFlagCount(serverCount: number) {
    this.optimistic = serverCount;
  }

  private trackFaces(s: FrameSignals, now: number) {
    if (s.faces === 0) this.absentSince ??= now;
    else if (this.absentSince !== null) {
      const d = now - this.absentSince;
      if (d >= this.cfg.face_absent_s * 1000) this.simple("FACE_ABSENT", this.absentSince, d);
      this.absentSince = null;
    }
    if (s.faces > 1) {
      this.multiSince ??= now;
      // capture evidence once the period qualifies, while both faces are still in view
      if (!this.multiSnapshot && now - this.multiSince >= this.cfg.multi_face_s * 1000) {
        this.multiSnapshot = this.hooks.snapshot() ?? "";
      }
    } else if (this.multiSince !== null) {
      const d = now - this.multiSince;
      if (d >= this.cfg.multi_face_s * 1000) this.simple("MULTIPLE_FACES", this.multiSince, d, this.multiSnapshot || null);
      this.multiSince = null;
      this.multiSnapshot = null;
    }
  }

  private simple(type: ClientEvent["type"], start: number, durationMs: number, snapshot?: string | null) {
    this.hooks.emit({
      client_event_id: newId(),
      type,
      started_at: new Date(start).toISOString(),
      duration_ms: durationMs,
      exam_clock_ms: this.clock(start),
      ...(snapshot ? { snapshot_b64: snapshot } : {}),
    });
  }
}
