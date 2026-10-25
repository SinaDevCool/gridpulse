import type { BatteryTimelinePoint } from "./select-battery-workspace";

/** Plot-only end boundary. It is never added to solver records or accepted as a new interval. */
export function extendStepHorizon(points: BatteryTimelinePoint[]) {
  const last = points.at(-1);
  if (!last?.endTimestamp || Date.parse(last.endTimestamp) <= Date.parse(last.timestamp)) return points;
  return [...points, { ...last, timestamp: last.endTimestamp, label: "Planning horizon end", durationMinutes: 0 }];
}
export type TimelineSelection = { activeIndex?: string | number | null; activeLabel?: string | number };
export function timelineSelection(state: TimelineSelection, points: BatteryTimelinePoint[]) {
  if (typeof state.activeLabel === "string" && points.some(point => point.timestamp === state.activeLabel)) return state.activeLabel;
  const index = Number(state.activeIndex);
  if (state.activeIndex != null && Number.isInteger(index) && index >= 0 && index < points.length)
    return points[index]?.timestamp;
  if (index === points.length && state.activeLabel === points.at(-1)?.endTimestamp) return points.at(-1)?.timestamp;
  return undefined;
}
