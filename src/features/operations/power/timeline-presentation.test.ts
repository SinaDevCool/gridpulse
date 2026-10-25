import { describe, expect, it } from "vitest";
import { batteryBoundaryPlot, extendStepHorizon, timelineSelection } from "./timeline-presentation";
import type { BatteryTimelinePoint } from "./select-battery-workspace";

const points = [{ timestamp: "2026-09-26T23:00:00Z", endTimestamp: "2026-09-27T00:00:00Z",
  durationMinutes: 60, gridImportMw: 50 }] as BatteryTimelinePoint[];
describe("plot-only step horizon", () => {
  it("places initial and ending SOC at actual boundaries without creating extra dispatch", () => {
    const input = [{ ...points[0], startingSocPercent: 78, socPercent: 70, batteryPowerMw: 5 }];
    const before = JSON.stringify(input);
    const plot = batteryBoundaryPlot(input);
    expect(plot.map(point => point.boundarySocPercent)).toEqual([78, 70]);
    expect(plot.at(-1)!.plotTime).toBe(Date.parse(points[0].endTimestamp!));
    expect(plot.at(-1)!.batteryPowerMw).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
    expect(timelineSelection({ activeLabel: Date.parse("2026-09-26T23:30:00Z") }, input)).toBe(input[0].timestamp);
    expect(timelineSelection({ activeLabel: Date.parse(points[0].endTimestamp!) }, input)).toBe(input[0].timestamp);
  });
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
