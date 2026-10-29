import { headAngles } from "./geometry";
import { LivenessDetector, type LivenessSample } from "./liveness";

const sample = (t: number, over: Partial<LivenessSample> = {}): LivenessSample => ({
  t,
  faces: 1,
  ear: 0.3,
  noseOffset: 0,
  ...over,
});

function feed(d: LivenessDetector, samples: LivenessSample[]) {
  return samples.map((s) => d.push(s)).at(-1);
}

const baseline = Array.from({ length: 5 }, (_, i) => sample(i * 100));

describe("LivenessDetector", () => {
  it("passes a double blink", () => {
    const d = new LivenessDetector("blink");
    const blink = (t: number) => [sample(t, { ear: 0.1 }), sample(t + 100, { ear: 0.3 })];
    expect(feed(d, [...baseline, ...blink(600), ...blink(900)])).toBe(true);
  });

  it("does not pass a single blink or a static photo", () => {
    const one = new LivenessDetector("blink");
    expect(feed(one, [...baseline, sample(600, { ear: 0.1 }), sample(700)])).toBe(false);
    const photo = new LivenessDetector("blink");
    expect(feed(photo, [...baseline, ...Array.from({ length: 50 }, (_, i) => sample(600 + i * 100))])).toBe(false);
  });

  it("requires a turn in the requested direction and a return to centre", () => {
    const left = new LivenessDetector("turn_left");
    expect(feed(left, [...baseline, sample(600, { noseOffset: 0.4 }), sample(800, { noseOffset: 0.02 })])).toBe(true);
    const wrongWay = new LivenessDetector("turn_left");
    expect(feed(wrongWay, [...baseline, sample(600, { noseOffset: -0.4 }), sample(800)])).toBe(false);
    const noReturn = new LivenessDetector("turn_right");
    expect(feed(noReturn, [...baseline, sample(600, { noseOffset: -0.4 })])).toBe(false);
  });

  it("ignores frames without exactly one face and reports multiple faces", () => {
    const d = new LivenessDetector("blink");
    feed(d, [...baseline, sample(600, { faces: 2, ear: 0.05 }), sample(700, { faces: 0 })]);
    expect(d.done).toBe(false);
    expect(d.detail()).toContain("multiple faces");
  });
});

describe("headAngles", () => {
  it("reads yaw from a rotation about the vertical axis", () => {
    const a = (30 * Math.PI) / 180;
    // column-major 4x4 rotation about Y
    const m = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
    const { yaw, pitch } = headAngles(m);
    expect(Math.abs(yaw)).toBeCloseTo(30, 5);
    expect(pitch).toBeCloseTo(0, 5);
  });
});
