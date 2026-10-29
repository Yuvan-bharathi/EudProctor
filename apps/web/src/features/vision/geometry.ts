/** Pure face-geometry helpers over MediaPipe Face Landmarker (478-point) output. */

export interface Point {
  x: number;
  y: number;
  z?: number;
}

// eye contour points: [outer, upper1, upper2, inner, lower2, lower1]
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
export const LM = {
  noseTip: 1,
  rightIris: 468,
  leftIris: 473,
  rightOuter: 33,
  rightInner: 133,
  rightUpper: 159,
  rightLower: 145,
  leftInner: 362,
  leftOuter: 263,
  leftUpper: 386,
  leftLower: 374,
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function ear(lm: Point[], idx: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i]);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4) + 1e-9);
}

/** Eye aspect ratio averaged over both eyes; drops sharply when the eyes close. */
export function eyeAspectRatio(lm: Point[]): number {
  return (ear(lm, RIGHT_EYE) + ear(lm, LEFT_EYE)) / 2;
}

/** Horizontal nose offset from the eye midpoint, in inter-eye distances. Changes sign with head turn. */
export function noseOffset(lm: Point[]): number {
  const a = lm[LM.rightOuter];
  const b = lm[LM.leftOuter];
  const mid = (a.x + b.x) / 2;
  return (lm[LM.noseTip].x - mid) / (Math.abs(b.x - a.x) + 1e-9);
}

/** Yaw/pitch/roll in degrees from a 4x4 column-major facial transformation matrix. */
export function headAngles(m: ArrayLike<number>): { yaw: number; pitch: number; roll: number } {
  const r = (row: number, col: number) => m[col * 4 + row];
  const deg = 180 / Math.PI;
  const yaw = Math.asin(Math.max(-1, Math.min(1, -r(2, 0)))) * deg;
  const pitch = Math.atan2(r(2, 1), r(2, 2)) * deg;
  const roll = Math.atan2(r(1, 0), r(0, 0)) * deg;
  return { yaw, pitch, roll };
}

/** Gaze ratios: 0..1 position of the iris between the eye corners (h) and lids (v), averaged over both eyes. */
export function gazeRatios(lm: Point[]): { h: number; v: number } {
  const ratio = (p: number, a: number, b: number) => (p - a) / (b - a + 1e-9);
  const hR = ratio(lm[LM.rightIris].x, lm[LM.rightOuter].x, lm[LM.rightInner].x);
  const hL = ratio(lm[LM.leftIris].x, lm[LM.leftInner].x, lm[LM.leftOuter].x);
  const vR = ratio(lm[LM.rightIris].y, lm[LM.rightUpper].y, lm[LM.rightLower].y);
  const vL = ratio(lm[LM.leftIris].y, lm[LM.leftUpper].y, lm[LM.leftLower].y);
  return { h: (hR + hL) / 2, v: (vR + vL) / 2 };
}

export function faceBox(lm: Point[], margin = 0.25) {
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const p of lm) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    x: Math.max(0, minX - w * margin),
    y: Math.max(0, minY - h * margin),
    w: Math.min(1, w * (1 + 2 * margin)),
    h: Math.min(1, h * (1 + 2 * margin)),
  };
}
