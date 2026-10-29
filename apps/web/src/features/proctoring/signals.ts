import type { Dir, ProctoringConfig, Source } from "./config";

/** Per-frame signals computed from the landmarker (in the worker). No image data. */
export interface FrameSignals {
  t: number; // epoch ms
  faces: number;
  yaw: number;
  pitch: number;
  gazeH: number;
  gazeV: number;
  box: { x: number; y: number; w: number; h: number } | null;
}

export interface Calibration {
  yaw: number;
  pitch: number;
  gazeH: [number, number];
  gazeV: [number, number];
  auto?: boolean;
}

export const GAZE_MARGIN = 0.06;
export const EMA_ALPHA = 0.4;

export class Smoother {
  private prev: FrameSignals | null = null;
  constructor(private alpha = EMA_ALPHA) {}
  push(s: FrameSignals): FrameSignals {
    if (!this.prev || s.faces !== 1 || this.prev.faces !== 1) {
      this.prev = s;
      return s;
    }
    const a = this.alpha;
    const mix = (x: number, y: number) => a * x + (1 - a) * y;
    this.prev = {
      ...s,
      yaw: mix(s.yaw, this.prev.yaw),
      pitch: mix(s.pitch, this.prev.pitch),
      gazeH: mix(s.gazeH, this.prev.gazeH),
      gazeV: mix(s.gazeV, this.prev.gazeV),
    };
    return this.prev;
  }
}

/** Decide whether the candidate is looking away, relative to the calibration baseline. */
export function awayFrom(
  s: FrameSignals,
  cal: Calibration,
  cfg: Pick<ProctoringConfig, "yaw_limit_deg" | "pitch_limit_deg" | "gaze_disabled">,
): { away: boolean; source: Source; direction: Dir } {
  const dy = s.yaw - cal.yaw;
  const dp = s.pitch - cal.pitch;
  const ry = Math.abs(dy) / cfg.yaw_limit_deg;
  const rp = Math.abs(dp) / cfg.pitch_limit_deg;
  if (ry > 1 || rp > 1) {
    const direction: Dir = ry >= rp ? (dy > 0 ? "left" : "right") : dp > 0 ? "down" : "up";
    return { away: true, source: "head", direction };
  }
  if (!cfg.gaze_disabled) {
    const [hMin, hMax] = cal.gazeH;
    const [vMin, vMax] = cal.gazeV;
    const dh = s.gazeH < hMin - GAZE_MARGIN ? s.gazeH - hMin : s.gazeH > hMax + GAZE_MARGIN ? s.gazeH - hMax : 0;
    const dv = s.gazeV < vMin - GAZE_MARGIN ? s.gazeV - vMin : s.gazeV > vMax + GAZE_MARGIN ? s.gazeV - vMax : 0;
    if (dh || dv) {
      const direction: Dir = Math.abs(dh) >= Math.abs(dv) ? (dh > 0 ? "left" : "right") : dv > 0 ? "down" : "up";
      return { away: true, source: "eyes", direction };
    }
  }
  return { away: false, source: "head", direction: "left" };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export type Target = "centre" | "top_left" | "top_right" | "bottom_left" | "bottom_right";
export const CALIBRATION_TARGETS: Target[] = ["centre", "top_left", "top_right", "bottom_left", "bottom_right"];

/** Baseline head pose from the centre target; on-screen gaze range from the medians at the four corners. */
export function buildCalibration(samples: Record<Target, FrameSignals[]>): Calibration | null {
  const ok = (xs: FrameSignals[]) => xs.filter((s) => s.faces === 1);
  const centre = ok(samples.centre);
  if (centre.length < 5) return null;
  const perTarget = CALIBRATION_TARGETS.map((t) => ok(samples[t])).filter((xs) => xs.length >= 3);
  const hs = perTarget.map((xs) => median(xs.map((s) => s.gazeH)));
  const vs = perTarget.map((xs) => median(xs.map((s) => s.gazeV)));
  return {
    yaw: median(centre.map((s) => s.yaw)),
    pitch: median(centre.map((s) => s.pitch)),
    gazeH: [Math.min(...hs), Math.max(...hs)],
    gazeV: [Math.min(...vs), Math.max(...vs)],
  };
}

/** Fallback when calibration is missing (e.g. page reload): baseline from the first seconds, generous gaze range. */
export function autoCalibration(first: FrameSignals[]): Calibration | null {
  const ok = first.filter((s) => s.faces === 1);
  if (ok.length < 10) return null;
  const h = median(ok.map((s) => s.gazeH));
  const v = median(ok.map((s) => s.gazeV));
  return { yaw: median(ok.map((s) => s.yaw)), pitch: median(ok.map((s) => s.pitch)), gazeH: [h - 0.15, h + 0.15], gazeV: [v - 0.15, v + 0.15], auto: true };
}

const KEY = (sessionId: string) => `eduproctor.calibration.${sessionId}`;

export function saveCalibration(sessionId: string, c: Calibration) {
  try {
    localStorage.setItem(KEY(sessionId), JSON.stringify(c));
  } catch {
    /* storage unavailable: auto-calibration will be used */
  }
}

export function loadCalibration(sessionId: string): Calibration | null {
  try {
    const raw = localStorage.getItem(KEY(sessionId));
    return raw ? (JSON.parse(raw) as Calibration) : null;
  } catch {
    return null;
  }
}
