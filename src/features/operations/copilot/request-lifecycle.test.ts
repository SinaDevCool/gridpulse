import { describe, expect, it } from "vitest";
import { createBriefRequestLifecycle } from "./request-lifecycle";

describe("brief request lifecycle", () => {
  it("suppresses same-tick duplicate submissions before React renders", () => {
    const gate = createBriefRequestLifecycle();
    const first = gate.begin("plan-a")!;
    expect(gate.begin("plan-a")).toBeNull();
    expect(gate.accepts(first, "plan-a")).toBe(true);
  });
  it("rejects late responses and does not finish a replacement request", () => {
    const gate = createBriefRequestLifecycle();
    const first = gate.begin("plan-a")!;
    const next = gate.begin("plan-b")!;
    expect(first.abort.signal.aborted).toBe(true);
    expect(gate.accepts(first, "plan-b")).toBe(false);
    expect(gate.finish(first)).toBe(false);
    expect(gate.accepts(next, "plan-b")).toBe(true);
  });
  it("preserves a request through inspection and cancels on stale inputs or unmount", () => {
    const gate = createBriefRequestLifecycle();
    const first = gate.begin("same-assessment")!;
    gate.sync("same-assessment");
    expect(gate.accepts(first, "same-assessment")).toBe(true);
    gate.sync("stale-inputs");
    expect(first.abort.signal.aborted).toBe(true);
    const next = gate.begin("new-assessment")!;
    gate.cancel();
    expect(gate.accepts(next, "new-assessment")).toBe(false);
  });
});
