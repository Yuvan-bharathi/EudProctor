import { listPending, putPending, removeAcked } from "./answerBuffer";

export type SyncStatus = "saved" | "pending" | "saving" | "offline";

export interface AnswerAck {
  question_id: string;
  client_seq: number;
  accepted: boolean;
}

export interface SendBatch {
  (answers: { question_id: string; value: Record<string, unknown>; client_seq: number; answered_at: string }[]): Promise<{
    acks: AnswerAck[];
  }>;
}

/**
 * Autosave engine: every edit is written to IndexedDB first, then flushed to the server at most every
 * `intervalMs` (≤ 10 s), on reconnect and before submit. A failed flush keeps everything buffered.
 */
export class AnswerSync {
  private seq = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = "saved";

  constructor(
    private sessionId: string,
    private send: SendBatch,
    private intervalMs = 10_000,
    private now: () => Date = () => new Date(),
  ) {}

  /** Seed sequence numbers from the server and from any answers still buffered locally. */
  async init(serverSeqs: Record<string, number>): Promise<Map<string, Record<string, unknown>>> {
    for (const [q, s] of Object.entries(serverSeqs)) this.seq.set(q, s);
    const local = new Map<string, Record<string, unknown>>();
    for (const p of await listPending(this.sessionId)) {
      this.seq.set(p.questionId, Math.max(this.seq.get(p.questionId) ?? 0, p.client_seq));
      local.set(p.questionId, p.value);
    }
    if (local.size) this.setStatus("pending");
    return local;
  }

  start() {
    this.timer = setInterval(() => void this.flush(), this.intervalMs);
    window.addEventListener("online", this.onOnline);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("online", this.onOnline);
  }

  private onOnline = () => void this.flush();

  subscribe(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  async record(questionId: string, value: Record<string, unknown>) {
    const next = (this.seq.get(questionId) ?? 0) + 1;
    this.seq.set(questionId, next);
    await putPending({
      sessionId: this.sessionId,
      questionId,
      value,
      client_seq: next,
      answered_at: this.now().toISOString(),
    });
    if (this.status !== "offline") this.setStatus("pending");
  }

  /** Send everything buffered. Safe to call concurrently (calls are serialised). */
  flush(): Promise<void> {
    this.flushing = (this.flushing ?? Promise.resolve()).then(() => this.doFlush());
    return this.flushing;
  }

  private async doFlush() {
    const pending = await listPending(this.sessionId);
    if (!pending.length) {
      if (this.status !== "offline") this.setStatus("saved");
      return;
    }
    this.setStatus("saving");
    try {
      const res = await this.send(
        pending.map((p) => ({
          question_id: p.questionId,
          value: p.value,
          client_seq: p.client_seq,
          answered_at: p.answered_at,
        })),
      );
      await removeAcked(this.sessionId, res.acks.filter((a) => a.accepted));
      const left = await listPending(this.sessionId);
      this.setStatus(left.length ? "pending" : "saved");
    } catch {
      this.setStatus("offline"); // keep everything in IndexedDB; retried on the next tick or reconnect
    }
  }

  async pendingCount() {
    return (await listPending(this.sessionId)).length;
  }
}
