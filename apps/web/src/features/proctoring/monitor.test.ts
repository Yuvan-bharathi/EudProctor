import type { ClientEvent, ProctoringConfig } from "./config";
import { watchIntegrity } from "./integrity";
import { ProctorMonitor } from "./monitor";
import type { Calibration, FrameSignals } from "./signals";

const CFG: ProctoringConfig = {
  glance_min_s: 1,
  flag_threshold_s: 3,
  max_flags: 3,
  yaw_limit_deg: 30,
  pitch_limit_deg: 20,
  face_absent_s: 3,
  multi_face_s: 2,
  tab_switch_s: 2,
  return_to_screen_s: 0.5,
  gaze_disabled: false,
};
const CAL: Calibration = { yaw: 0, pitch: 0, gazeH: [0.4, 0.6], gazeV: [0.4, 0.6] };

function setup(flagCount = 0) {
  const events: ClientEvent[] = [];
  const notices: number[] = [];
  let count = flagCount;
  const m = new ProctorMonitor(CFG, CAL, 0, {
    emit: (e) => events.push(e),
    notice: (n) => notices.push(n),
    snapshot: () => "SNAP",
    flagCount: () => count,
  });
  let t = 1000;
  const frames = (ms: number, over: Partial<FrameSignals>) => {
    for (const end = t + ms; t < end; t += 100) {
      m.onSignals({ t, faces: 1, yaw: 0, pitch: 0, gazeH: 0.5, gazeV: 0.5, box: null, ...over });
    }
  };
  return { m, events, notices, frames, setCount: (n: number) => (count = n) };
}

describe("ProctorMonitor", () => {
  it("shows the notice when an ongoing look-away crosses the threshold and finalises one event with evidence", () => {
    const { events, notices, frames } = setup();
    frames(2000, {});
    frames(2900, { yaw: 45 });
    expect(notices).toEqual([]);
    frames(1100, { yaw: 45 }); // now 4 s away: notice during the look-away
    expect(notices).toEqual([1]);
    frames(1500, {});
    const final = events.filter((e) => e.type === "LOOK_AWAY");
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ source: "head", snapshot_b64: "SNAP" });
    // EMA smoothing shifts both edges by a frame or two
    expect(final[0].duration_ms).toBeGreaterThanOrEqual(3700);
    expect(final[0].duration_ms).toBeLessThanOrEqual(4000);
    // live progress used the same id as the final event
    expect(events.some((e) => e.type === "LOOK_AWAY_PROGRESS" && e.client_event_id === final[0].client_event_id)).toBe(true);
  });

  it("glances never show a notice or carry a snapshot", () => {
    const { events, notices, frames } = setup();
    frames(2000, {});
    frames(1500, { gazeH: 0.9 });
    frames(1000, {});
    expect(notices).toEqual([]);
    const ev = events.find((e) => e.type === "LOOK_AWAY")!;
    expect(ev.source).toBe("eyes");
    expect(ev.snapshot_b64).toBeUndefined();
  });

  it("no notice after the limit (post-limit is mentor-only)", () => {
    const { notices, frames } = setup(3);
    frames(1000, {});
    frames(5000, { yaw: -45 });
    frames(1000, {});
    expect(notices).toEqual([]);
  });

  it("reports face absent and multiple faces only above their thresholds", () => {
    const { events, frames } = setup();
    frames(1000, {});
    frames(3500, { faces: 0 });
    frames(500, {});
    frames(1000, { faces: 2 });
    frames(500, {});
    frames(2500, { faces: 2 });
    frames(500, {});
    expect(events.filter((e) => e.type !== "LOOK_AWAY_PROGRESS").map((e) => e.type)).toEqual(["FACE_ABSENT", "MULTIPLE_FACES"]);
  });

  it("respects the gaze accommodation", () => {
    const events: ClientEvent[] = [];
    const m = new ProctorMonitor({ ...CFG, gaze_disabled: true }, CAL, 0, {
      emit: (e) => events.push(e),
      notice: () => undefined,
      snapshot: () => null,
      flagCount: () => 0,
    });
    for (let t = 0; t < 6000; t += 100) m.onSignals({ t, faces: 1, yaw: 0, pitch: 0, gazeH: 0.95, gazeV: 0.5, box: null });
    expect(events).toEqual([]);
  });
});

describe("integrity events", () => {
  it("blocks and logs copy/paste, and logs tab switches longer than the threshold", () => {
    vi.useFakeTimers();
    const events: ClientEvent[] = [];
    const stop = watchIntegrity(CFG, 0, (e) => events.push(e));
    const paste = new Event("paste", { cancelable: true }) as ClipboardEvent;
    document.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(2500);
    window.dispatchEvent(new Event("focus"));
    stop();
    vi.useRealTimers();
    expect(events.map((e) => e.type)).toEqual(["COPY_PASTE_ATTEMPT", "TAB_SWITCH"]);
    expect(events[1].duration_ms).toBeGreaterThanOrEqual(2500);
  });
});
