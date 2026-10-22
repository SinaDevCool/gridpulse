import type { OperationsInterval } from "../scenario-engine";
export type DemandKey =
  "baselineDemandMw" | "batteryDemandMw" | "workloadDemandMw" | "combinedDemandMw";
/** Explicit interval durations preserve gaps; this never recalculates dispatch. */
export function selectBreachSpans(points: OperationsInterval[], key: DemandKey, limit: number) {
  const spans: { start: number; end: number; timestamp: string; minutes: number }[] = [];
  for (const point of points) {
    const start = Date.parse(point.timestamp);
    if (
      !Number.isFinite(start) ||
      !(point.durationMinutes && point.durationMinutes > 0) ||
      point[key] <= limit
    )
      continue;
    const end = start + point.durationMinutes * 60_000;
    const previous = spans.at(-1);
    if (previous?.end === start) {
      previous.end = end;
      previous.minutes += point.durationMinutes;
    } else spans.push({ start, end, timestamp: point.timestamp, minutes: point.durationMinutes });
  }
  return spans;
}
