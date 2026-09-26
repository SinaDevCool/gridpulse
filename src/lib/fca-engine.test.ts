import { describe, expect, it } from "vitest";
import { validateIntervalProfile, type IntervalPoint } from "./fca-engine";

const points = (loads: number[]): IntervalPoint[] => loads.map((importMw, index) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, index * 15)).toISOString(), importMw, exportMw: 0,
}));

describe("interval profile transport validation", () => {
  it("accepts complete 15-minute data", () => expect(validateIntervalProfile(points([50, 51, 52])).valid).toBe(true));
  it("reports missing intervals", () => {
    const profile = points([50, 51, 52]);
    profile[2].timestamp = new Date(Date.UTC(2026, 0, 1, 1, 0)).toISOString();
    expect(validateIntervalProfile(profile).missingIntervals).toBe(2);
  });
});
