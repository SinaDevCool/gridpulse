import { describe, expect, it } from "vitest";
import { assessmentLifecycle } from "./assessment-lifecycle";
describe("assessment lifecycle", () => {
  it("distinguishes initial loading, ready data, same-input refresh, failure and cancellation", () => {
    const state = { hasResult: false, fetching: true, failed: false, cancelled: false };
    expect(assessmentLifecycle(state)).toBe("loading");
    expect(assessmentLifecycle({ ...state, hasResult: true })).toBe("stale");
    expect(assessmentLifecycle({ ...state, hasResult: true, fetching: false })).toBe("ready");
    expect(assessmentLifecycle({ ...state, failed: true })).toBe("failed");
    expect(assessmentLifecycle({ ...state, failed: true, cancelled: true })).toBe("cancelled");
  });
});
