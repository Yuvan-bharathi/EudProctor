import type { ClientEvent, FlagStatus } from "./config";

/** Batches proctoring events every 2 s with an IndexedDB buffer for offline periods. Idempotent per event id. */

const DB = "eduproctor-events";
const STORE = "events";

interface Stored extends ClientEvent {
  sessionId: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: ["sessionId", "client_event_id"] }).createIndex("bySession", "sessionId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r ? r.result : undefined);
    };
    t.onerror = () => reject(t.error);
  });
}

export const MAX_BATCH = 200;

export class EventUploader {
  private timer: ReturnType<typeof setInterval> | null = null;
  private live: ClientEvent[] = []; // LOOK_AWAY_PROGRESS: live view only, never buffered
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private sessionId: string,
    private send: (events: ClientEvent[]) => Promise<FlagStatus>,
    private onStatus?: (s: FlagStatus) => void,
    private intervalMs = 2000,
  ) {}

  start() {
    this.timer = setInterval(() => void this.flush(), this.intervalMs);
    window.addEventListener("online", this.onOnline);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("online", this.onOnline);
  }

  private onOnline = () => void this.flush();

  async enqueue(ev: ClientEvent) {
    if (ev.type === "LOOK_AWAY_PROGRESS") {
      this.live = [...this.live.filter((e) => e.client_event_id !== ev.client_event_id), ev];
      return;
    }
    await withStore("readwrite", (s) => s.put({ ...ev, sessionId: this.sessionId } satisfies Stored));
  }

  flush(): Promise<void> {
    this.chain = this.chain.then(() => this.doFlush());
    return this.chain;
  }

  private async doFlush() {
    const stored = ((await withStore<Stored[]>("readonly", (s) => s.index("bySession").getAll(this.sessionId))) ?? []).slice(
      0,
      MAX_BATCH,
    );
    const live = this.live;
    this.live = [];
    if (!stored.length && !live.length) return;
    try {
      const status = await this.send([...stored.map(({ sessionId: _s, ...ev }) => ev), ...live]);
      await withStore("readwrite", (s) => {
        for (const ev of stored) s.delete([this.sessionId, ev.client_event_id]);
      });
      this.onStatus?.({ flag_count: status.flag_count, max_flags: status.max_flags });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status !== undefined && status >= 400 && status < 500 && ![401, 408, 429].includes(status)) {
        // the server rejected this batch: retrying would block every later event, so drop it
        await withStore("readwrite", (s) => {
          for (const ev of stored) s.delete([this.sessionId, ev.client_event_id]);
        });
      }
      // otherwise offline / server error: stored events stay in IndexedDB; live progress is dropped
    }
  }
}
