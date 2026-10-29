/** IndexedDB buffer for answers not yet acknowledged by the server. Survives reloads and offline periods. */

export interface PendingAnswer {
  sessionId: string;
  questionId: string;
  value: Record<string, unknown>;
  client_seq: number;
  answered_at: string;
}

const DB_NAME = "eduproctor";
const STORE = "pending_answers";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: ["sessionId", "questionId"] });
      store.createIndex("bySession", "sessionId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    t.onerror = () => reject(t.error);
  });
}

export async function putPending(a: PendingAnswer): Promise<void> {
  await tx("readwrite", (s) => s.put(a));
}

export async function listPending(sessionId: string): Promise<PendingAnswer[]> {
  return (await tx<PendingAnswer[]>("readonly", (s) => s.index("bySession").getAll(sessionId))) ?? [];
}

/** Remove a buffered answer only if the server holds this seq or newer (a newer local edit is kept). */
export async function removeAcked(sessionId: string, acks: { question_id: string; client_seq: number }[]) {
  const pending = new Map((await listPending(sessionId)).map((p) => [p.questionId, p]));
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const store = t.objectStore(STORE);
    for (const ack of acks) {
      const p = pending.get(ack.question_id);
      if (p && p.client_seq <= ack.client_seq) store.delete([sessionId, ack.question_id]);
    }
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
