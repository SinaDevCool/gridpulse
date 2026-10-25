import { describe, expect, it } from "vitest";
import { extendStepHorizon, timelineSelection } from "./timeline-presentation";
import type { BatteryTimelinePoint } from "./select-battery-workspace";

const points = [{ timestamp: "2026-09-26T23:00:00Z", endTimestamp: "2026-09-27T00:00:00Z",
  durationMinutes: 60, gridImportMw: 50 }] as BatteryTimelinePoint[];
describe("plot-only step horizon", () => {
  it("extends the returned interval to its end without altering solver records", () => {
    const before = JSON.stringify(points);
    const plot = extendStepHorizon(points);
    expect(plot).toHaveLength(2);
    expect(plot[1].timestamp).toBe(points[0].endTimestamp);
    expect(plot[1].durationMinutes).toBe(0);
    expect(JSON.stringify(points)).toBe(before);
  });
  it("maps the plot-only boundary back to a real interval", () => {
    expect(timelineSelection({ activeIndex: 1, activeLabel: points[0].endTimestamp! }, points)).toBe(points[0].timestamp);
    expect(timelineSelection({ activeIndex: 100 }, points)).toBeUndefined();
    expect(timelineSelection({}, points)).toBeUndefined();
  });
  it("does not invent an end boundary for missing evidence", () => {
    expect(extendStepHorizon([])).toEqual([]);
    expect(extendStepHorizon([{ ...points[0], endTimestamp: null }])).toHaveLength(1);
  });
});
