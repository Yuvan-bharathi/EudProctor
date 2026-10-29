/** Remaining time from the server deadline, corrected for client clock skew. Never derived from duration. */
export function makeClock(serverNowIso: string, deadlineIso: string | null, clientNow = Date.now()) {
  const offset = new Date(serverNowIso).getTime() - clientNow;
  const deadline = deadlineIso ? new Date(deadlineIso).getTime() : null;
  return {
    remainingMs(now = Date.now()) {
      if (deadline === null) return null;
      return Math.max(0, deadline - (now + offset));
    },
  };
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
