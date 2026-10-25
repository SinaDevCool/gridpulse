import { describe, expect, it } from "vitest";
import { batteryBoundaryPlot, batteryTimelinePlot, extendStepHorizon, timelineSelection } from "./timeline-presentation";
import { batteryChartScales, batteryTimeTicks } from "./timeline-scales";
import { batteryPanelLegend } from "./timeline-legend";
import type { BatteryTimelinePoint } from "./select-battery-workspace";

const points = [{ timestamp: "2026-09-26T23:00:00Z", endTimestamp: "2026-09-27T00:00:00Z",
  durationMinutes: 60, gridImportMw: 50 }] as BatteryTimelinePoint[];
describe("plot-only step horizon", () => {
  it("rounds visible power and signed dispatch axes without letting hidden baseline inflate them", () => {
    const input = [{ ...points[0], facilityDemandMw: 117.2, baselineDemandMw: 10000,
      workloadPowerMw: 9000, gridImportMw: 97.1, batteryPowerMw: -5.3, availableDischargeMw: 5 }];
    const before = JSON.stringify(input);
    const scales = batteryChartScales(input, 100, 98);
    expect(scales.facility).toEqual({ maximum: 120, ticks: [0, 30, 60, 90, 120] });
    expect(scales.dispatch).toEqual({ maximum: 6, ticks: [-6, -3, 0, 3, 6] });
    expect(batteryChartScales([{ ...input[0], batteryPowerMw: 0, availableDischargeMw: null }], 100, 98).dispatch.ticks).toEqual([-1, -.5, 0, .5, 1]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("uses responsive time ticks without dropping intervals or labelling same-day ends as tomorrow", () => {
    const start = Date.parse(points[0].timestamp), end = Date.parse(points[0].endTimestamp!);
    expect(batteryTimeTicks(start, end, false)).toHaveLength(9);
    expect(batteryTimeTicks(start, end, true)).toHaveLength(5);
    expect(batteryTimeTicks(end, start, true)).toEqual([]);
    const plot = batteryTimelinePlot(points, true, points[0].timestamp, true, true, false);
    expect(plot.selectionRange).toEqual([start, end]);
    expect(plot.cursorProps.strokeDasharray).toBe("4 4");
    expect(plot.timeLabel(end)).toBe("00:00 +1 day");
    const sameDay = [{ ...points[0], timestamp: "2026-09-26T22:00:00Z", endTimestamp: "2026-09-26T23:00:00Z" }];
    expect(batteryTimelinePlot(sameDay, true, null, false, false, false).timeLabel(Date.parse(sameDay[0].endTimestamp))).toBe("23:00");
  });
  it("groups the existing legend identities and omits missing discharge evidence", () => {
    const facility = batteryPanelLegend("facility", false);
    expect(facility[0]).toMatchObject({ id: "Facility demand", label: "Before battery", mark: "dash" });
    expect(batteryPanelLegend("dispatch", false).map(item => item.label)).toEqual(["Battery dispatch"]);
    expect(batteryPanelLegend("dispatch", true).map(item => item.label)).toEqual(["Battery dispatch", "Available discharge"]);
    expect(batteryPanelLegend("soc", false).map(item => item.label)).toEqual(["Protected reserve", "State of charge"].reverse());
  });
  it("renders a quarter-hour day with 97 SOC boundaries and 96 dispatch records", () => {
    const origin = Date.parse("2026-09-26T00:00:00Z");
    const input = Array.from({ length: 96 }, (_, index) => ({
      ...points[0], timestamp: new Date(origin + index * 900000).toISOString(),
      endTimestamp: new Date(origin + (index + 1) * 900000).toISOString(),
      durationMinutes: 15, startingSocPercent: 78, socPercent: 78, batteryPowerMw: 0,
    }));
    const plot = batteryBoundaryPlot(input);
    expect(plot).toHaveLength(97);
    expect(plot.filter(point => point.batteryPowerMw !== null)).toHaveLength(96);
    expect(plot.at(-1)!.plotTime).toBe(origin + 86400000);
    expect(timelineSelection({ activeLabel: origin + 23.75 * 3600000 }, input)).toBe(input[95].timestamp);
    expect(input).toHaveLength(96);
  });
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
