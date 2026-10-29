/** The 10 reference test cases (.claude/skills/proctoring-engine/reference.md), browser side. */
import { classify, reconcileCount } from "./classify";
import type { ClientEvent, LookAwayEvent, ProctoringConfig } from "./config";
import { type LookState, step } from "./lookAway";
import { EventUploader } from "./uploader";

// Test fixture mirroring the documented defaults; production values always come from the server.
const CFG: ProctoringConfig = {
  glance_min_s: 1.0,
  flag_threshold_s: 3.0,
  max_flags: 3,
  yaw_limit_deg: 30,
  pitch_limit_deg: 20,
  face_absent_s: 3,
  multi_face_s: 2,
  tab_switch_s: 2,
  return_to_screen_s: 0.5,
  gaze_disabled: false,
};
const FRAME = 100; // ~10 fps

/** Drive the state machine with [awayMs, backMs, awayMs, ...] segments, then stay on screen. */
function run(segments: number[]): LookAwayEvent[] {
  let s: LookState = { phase: "on" };
  const out: LookAwayEvent[] = [];
  let t = 0;
  const feed = (ms: number, away: boolean) => {
    for (let end = t + ms; t < end; t += FRAME) {
      const [next, ev] = step(s, t, away, "head", "right", CFG);
      s = next;
      if (ev) out.push(ev);
    }
  };
  segments.forEach((ms, i) => feed(ms, i % 2 === 0));
  feed(2000, false);
  return out;
}

function classifyAll(durations: number[]) {
  let flags = 0;
  return durations.map((d) => {
    const c = classify(d, flags, CFG);
    if (c === "flag") flags++;
    return { c, flagNo: c === "flag" ? flags : null, notified: c === "flag" };
  });
}

describe("look-away reference cases", () => {
  it("1: look-away 0.8 s -> nothing stored", () => {
    expect(run([800])).toEqual([]);
  });

  it("2: look-away 1.0 s -> glance", () => {
    const [ev] = run([1000]);
    expect(ev.durationMs).toBe(1000);
    expect(classify(ev.durationMs, 0, CFG)).toBe("glance");
  });

  it("3: look-away 2.9 s -> glance", () => {
    const [ev] = run([2900]);
    expect(classify(ev.durationMs, 0, CFG)).toBe("glance");
  });

  it("4: look-away 3.0 s with 0 flags -> flag #1, candidate notified", () => {
    const [ev] = run([3000]);
    expect(classifyAll([ev.durationMs])).toEqual([{ c: "flag", flagNo: 1, notified: true }]);
  });

  it("5: one continuous look-away of 12 s -> exactly one flag", () => {
    const events = run([12_000]);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBe(12_000);
    expect(classify(events[0].durationMs, 0, CFG)).toBe("flag");
  });

  it("6: four look-aways of 4 s -> flags 1-3 notified, 4th post_limit not notified", () => {
    const events = run([4000, 1000, 4000, 1000, 4000, 1000, 4000]);
    expect(events).toHaveLength(4);
    expect(classifyAll(events.map((e) => e.durationMs))).toEqual([
      { c: "flag", flagNo: 1, notified: true },
      { c: "flag", flagNo: 2, notified: true },
      { c: "flag", flagNo: 3, notified: true },
      { c: "post_limit", flagNo: null, notified: false },
    ]);
  });

  it("7: concurrent batches -> the counter shows the server count, never above max", () => {
    // two optimistic notices raced; the server says 3 of 3
    expect(reconcileCount(4, { flag_count: 3, max_flags: 3 })).toBe(3);
    expect(reconcileCount(1, { flag_count: 2, max_flags: 3 })).toBe(2);
  });

  it("8: any number of flags -> proctoring only ever calls the events endpoint (never submit/pause)", async () => {
    const calls: string[] = [];
    const uploader = new EventUploader(`s-${Math.random()}`, async (events) => {
      calls.push(`events:${events.length}`);
      return { flag_count: 3, max_flags: 3 };
    });
    for (let i = 0; i < 6; i++) {
      await uploader.enqueue({
        client_event_id: `e${i}-${Math.random()}`,
        type: "LOOK_AWAY",
        source: "head",
        direction: "left",
        started_at: new Date(i * 10_000).toISOString(),
        duration_ms: 4000,
      } satisfies ClientEvent);
    }
    await uploader.flush();
    expect(calls).toEqual(["events:6"]);
    // the module exposes no way to change the session
    expect(Object.getOwnPropertyNames(EventUploader.prototype).filter((n) => /submit|pause|block|stop/i.test(n))).toEqual(["stop"]);
  });

  it("9: 1.5 s away, 0.2 s back, 2 s away -> merged into one 3.7 s look-away -> flag", () => {
    const events = run([1500, 200, 2000]);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBe(3700);
    expect(classify(events[0].durationMs, 0, CFG)).toBe("flag");
  });

  it("10: flag-status -> only {flag_count, max_flags} is used", async () => {
    let seen: unknown = null;
    const uploader = new EventUploader(`s-${Math.random()}`, async () => ({ flag_count: 1, max_flags: 3 }), (fs) => (seen = fs));
    await uploader.enqueue({
      client_event_id: `x-${Math.random()}`,
      type: "TAB_SWITCH",
      started_at: new Date().toISOString(),
      duration_ms: 3000,
    });
    await uploader.flush();
    expect(seen).toEqual({ flag_count: 1, max_flags: 3 });
  });
});

describe("boundaries", () => {
  it.each([
    [999, "ignore"],
    [1000, "glance"],
    [2990, "glance"],
    [3000, "flag"],
  ] as const)("%i ms -> %s", (ms, expected) => {
    expect(classify(ms, 0, CFG)).toBe(expected);
  });

  it("a return shorter than return_to_screen_s does not split a look-away; a longer one does", () => {
    expect(run([1500, 400, 1500])).toHaveLength(1);
    expect(run([1500, 600, 1500])).toHaveLength(2);
  });
});
