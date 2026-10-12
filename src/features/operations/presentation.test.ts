import { describe, expect, it } from "vitest";
import { formatMinutes, formatOperationsTime, importThresholds } from "./presentation";

describe("Operations display contracts", () => {
  it("distinguishes the facility limit from the reserve target", () => {
    const result = importThresholds(101.6, 100, 2);
    expect(result.limitExceedanceMw).toBeCloseTo(1.6);
    expect(result.targetShortfallMw).toBeCloseTo(3.6);
    expect(importThresholds(null, 100, 2).limitExceedanceMw).toBeNull();
  });
  it("uses explicit UTC rather than the browser/server timezone", () => {
    expect(formatOperationsTime("2026-09-26T08:00:00Z")).toBe("08:00 UTC");
    expect(formatOperationsTime("invalid")).toBe("Unavailable");
  });
  it("uses readable duration without claiming endurance", () => {
    expect(formatMinutes(135)).toBe("2 h 15 min");
    expect(formatMinutes(60)).toBe("1 h");
  });
});
