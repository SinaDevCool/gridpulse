/** Synchronous gate: React state alone cannot exclude two calls in one render. */
export function createBriefRequestLifecycle() {
  let identity = "";
  let sequence = 0;
  let active: { sequence: number; abort: AbortController } | null = null;
  const sync = (next: string) => {
    if (next === identity) return;
    active?.abort.abort(); active = null; identity = next; sequence++;
  };
  return {
    sync,
    begin(next: string) {
      sync(next);
      if (active) return null;
      active = { sequence: ++sequence, abort: new AbortController() };
      return active;
    },
    accepts(ticket: { sequence: number; abort: AbortController }, next: string) {
      return identity === next && active === ticket && !ticket.abort.signal.aborted;
    },
    finish(ticket: { sequence: number }) {
      if (active?.sequence !== ticket.sequence) return false;
      active = null; return true;
    },
    cancel() { active?.abort.abort(); active = null; sequence++; },
  };
}
