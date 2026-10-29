/** Active liveness challenge evaluated in the browser from landmark samples (no video leaves the device). */

export type Challenge = "blink" | "turn_left" | "turn_right";

export interface LivenessSample {
  t: number; // ms
  faces: number;
  ear: number;
  noseOffset: number;
}

export const LIVENESS_CFG = {
  baselineSamples: 5,
  closedRatio: 0.65, // EAR below this fraction of the open-eye baseline = closed
  openRatio: 0.85,
  blinksNeeded: 2,
  turnDelta: 0.25, // nose offset change in inter-eye distances
  returnDelta: 0.1,
  // Camera images are not mirrored: when the candidate turns to THEIR left, the nose moves toward image +x.
  leftSign: 1,
};

export const challengeText: Record<Challenge, string> = {
  blink: "Please blink twice.",
  turn_left: "Slowly turn your head to your left, then back to the screen.",
  turn_right: "Slowly turn your head to your right, then back to the screen.",
};

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export class LivenessDetector {
  private base: LivenessSample[] = [];
  private eyesClosed = false;
  private blinks = 0;
  private turned = false;
  private passed = false;
  private sawMultipleFaces = false;

  constructor(
    private challenge: Challenge,
    private cfg = LIVENESS_CFG,
  ) {}

  push(s: LivenessSample): boolean {
    if (this.passed) return true;
    if (s.faces > 1) this.sawMultipleFaces = true;
    if (s.faces !== 1) return false;
    if (this.base.length < this.cfg.baselineSamples) {
      this.base.push(s);
      return false;
    }
    if (this.challenge === "blink") {
      const open = median(this.base.map((b) => b.ear));
      if (!this.eyesClosed && s.ear < open * this.cfg.closedRatio) this.eyesClosed = true;
      else if (this.eyesClosed && s.ear > open * this.cfg.openRatio) {
        this.eyesClosed = false;
        this.blinks += 1;
      }
      this.passed = this.blinks >= this.cfg.blinksNeeded;
    } else {
      const centre = median(this.base.map((b) => b.noseOffset));
      const sign = this.challenge === "turn_left" ? this.cfg.leftSign : -this.cfg.leftSign;
      const delta = (s.noseOffset - centre) * sign;
      if (delta > this.cfg.turnDelta) this.turned = true;
      if (this.turned && Math.abs(s.noseOffset - centre) < this.cfg.returnDelta) this.passed = true;
    }
    return this.passed;
  }

  get done() {
    return this.passed;
  }

  detail(): string {
    const parts: string[] = [this.challenge];
    if (this.challenge === "blink") parts.push(`blinks=${this.blinks}`);
    else parts.push(this.turned ? "turned" : "no turn");
    if (this.sawMultipleFaces) parts.push("multiple faces seen");
    return parts.join(" · ");
  }
}
