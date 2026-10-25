import type { BatteryTimelinePoint } from "./select-battery-workspace";
import { formatOperationsTime } from "../presentation";

export const timelineTimeLabel = (value: string | number) =>
  formatOperationsTime(typeof value === "number" ? new Date(value).toISOString() : value).replace(" UTC", "");
export function batteryTimeAxis(points: BatteryTimelinePoint[], boundaries: boolean) {
  return boundaries ? { type: "number" as const, scale: "time" as const,
    domain: [Date.parse(points[0].timestamp), Date.parse(points.at(-1)!.endTimestamp!)] } : {};
}

/** Plot-only end boundary. It is never added to solver records or accepted as a new interval. */
export function extendStepHorizon(points: BatteryTimelinePoint[]) {
  const last = points.at(-1);
  if (!last?.endTimestamp || Date.parse(last.endTimestamp) <= Date.parse(last.timestamp)) return points;
  return [...points, { ...last, timestamp: last.endTimestamp, label: "Planning horizon end", durationMinutes: 0 }];
}
export type TimelineSelection = { activeIndex?: string | number | null; activeLabel?: string | number };
export function timelineSelection(state: TimelineSelection, points: BatteryTimelinePoint[]) {
  if (typeof state.activeLabel === "string" && points.some(point => point.timestamp === state.activeLabel)) return state.activeLabel;
  if (typeof state.activeLabel === "number") {
    const time = state.activeLabel;
    const point = points.find(point => time >= Date.parse(point.timestamp) &&
      time < Date.parse(point.endTimestamp ?? point.timestamp));
    if (point) return point.timestamp;
    if (time === Date.parse(points.at(-1)?.endTimestamp ?? "")) return points.at(-1)?.timestamp;
    return undefined;
  }
  const index = Number(state.activeIndex);
  if (state.activeIndex != null && Number.isInteger(index) && index >= 0 && index < points.length)
    return points[index]?.timestamp;
  if (index === points.length && state.activeLabel === points.at(-1)?.endTimestamp) return points.at(-1)?.timestamp;
  return undefined;
}
/** Boundary states are plot-only; dispatch remains attached to the original intervals. */
export function batteryBoundaryPlot(points: BatteryTimelinePoint[]) {
  const last = points.at(-1);
  const rows = points.map(point => ({ ...point, plotTime: Date.parse(point.timestamp),
    boundarySocPercent: point.startingSocPercent }));
  return last?.endTimestamp ? [...rows, { ...last, timestamp: last.endTimestamp,
    plotTime: Date.parse(last.endTimestamp), boundarySocPercent: last.socPercent,
    label: "Planning horizon end", durationMinutes: 0, batteryPowerMw: null, availableDischargeMw: null }] : rows;
}
