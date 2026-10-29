import { AnswerSync, type SendBatch } from "./answerSync";
import { makeClock } from "./clock";

/** Minimal server: keeps the highest client_seq per question (same rule as the API). */
function fakeServer() {
  const stored = new Map<string, { value: Record<string, unknown>; seq: number }>();
  let online = true;
  let calls = 0;
  const send: SendBatch = async (answers) => {
    calls++;
    if (!online) throw new TypeError("Failed to fetch");
    const acks = answers.map((a) => {
      const cur = stored.get(a.question_id);
      if (!cur || a.client_seq > cur.seq) stored.set(a.question_id, { value: a.value, seq: a.client_seq });
      return { question_id: a.question_id, client_seq: stored.get(a.question_id)!.seq, accepted: true };
    });
    return { acks };
  };
  return {
    send,
    stored,
    setOnline: (v: boolean) => (online = v),
    calls: () => calls,
  };
}

let n = 0;
const newSession = () => `session-${++n}`;

describe("AnswerSync", () => {
  it("loses no answers across a 5-minute network drop", async () => {
    const server = fakeServer();
    let t = new Date("2026-11-02T10:00:00Z").getTime();
    const sync = new AnswerSync(newSession(), server.send, 10_000, () => new Date(t));
    await sync.init({});

    await sync.record("q1", { option_key: "A" });
    await sync.flush();
    expect(server.stored.get("q1")?.value).toEqual({ option_key: "A" });

    server.setOnline(false);
    // 5 minutes offline: an edit roughly every 10 s on three questions, flush attempts every tick
    for (let tick = 0; tick < 30; tick++) {
      t += 10_000;
      await sync.record(`q${(tick % 3) + 1}`, { option_key: "ABC"[tick % 3] + tick });
      await sync.flush();
      expect(sync.status).toBe("offline");
    }
    expect(await sync.pendingCount()).toBe(3);

    server.setOnline(true);
    await sync.flush();
    expect(sync.status).toBe("saved");
    expect(await sync.pendingCount()).toBe(0);
    expect(server.stored.get("q1")?.value).toEqual({ option_key: "A27" });
    expect(server.stored.get("q2")?.value).toEqual({ option_key: "B28" });
    expect(server.stored.get("q3")?.value).toEqual({ option_key: "C29" });
  });

  it("keeps buffered answers across a page reload", async () => {
    const server = fakeServer();
    const id = newSession();
    server.setOnline(false);
    const first = new AnswerSync(id, server.send);
    await first.init({});
    await first.record("q1", { option_key: "B" });
    await first.flush();

    // reload: a new instance restores the answer and continues the sequence
    const second = new AnswerSync(id, server.send);
    const restored = await second.init({});
    expect(restored.get("q1")).toEqual({ option_key: "B" });
    await second.record("q1", { option_key: "C" });
    server.setOnline(true);
    await second.flush();
    expect(server.stored.get("q1")).toEqual({ value: { option_key: "C" }, seq: 2 });
  });

  it("continues sequence numbers from the server so retries stay idempotent", async () => {
    const server = fakeServer();
    server.stored.set("q1", { value: { option_key: "A" }, seq: 7 });
    const sync = new AnswerSync(newSession(), server.send);
    await sync.init({ q1: 7 });
    await sync.record("q1", { option_key: "B" });
    await sync.flush();
    await sync.flush(); // nothing left: no duplicate send
    expect(server.stored.get("q1")).toEqual({ value: { option_key: "B" }, seq: 8 });
    expect(server.calls()).toBe(1);
  });
});

describe("server clock", () => {
  it("shows the remaining time after reconnect instead of resetting", () => {
    // started at 10:00 with a 30-minute deadline; the candidate reconnects at 10:12 (client clock 3 min fast)
    const clientNow = new Date("2026-11-02T10:15:00Z").getTime();
    const clock = makeClock("2026-11-02T10:12:00Z", "2026-11-02T10:30:00Z", clientNow);
    expect(clock.remainingMs(clientNow)).toBe(18 * 60_000);
    expect(clock.remainingMs(clientNow + 60_000)).toBe(17 * 60_000);
  });

  it("never goes below zero", () => {
    const clock = makeClock("2026-11-02T10:31:00Z", "2026-11-02T10:30:00Z", 0);
    expect(clock.remainingMs(0)).toBe(0);
  });
});
