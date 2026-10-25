import type { BatteryTimelinePoint } from "./select-battery-workspace";

/** Presentation-only nice ticks, extending the rounding rule reviewed for Compute. */
export function roundedPowerAxis(maximum: number) {
  const rawStep = Math.max(1, maximum) / 4;
  const scale = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 2.5, 3, 5, 10].find(value => value * scale >= rawStep) ?? 10) * scale;
  const count = Math.max(1, Math.ceil(maximum / step));
  return { maximum: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

export function batteryChartScales(data: BatteryTimelinePoint[], limit: number, target: number) {
  // Baseline/workload series are not displayed in this battery panel.
  const facility = roundedPowerAxis(Math.max(1, limit, target,
    ...data.flatMap(point => [point.facilityDemandMw ?? 0, point.gridImportMw])) * 1.01);
  const extent = Math.max(1, ...data.flatMap(point => [Math.abs(point.batteryPowerMw ?? 0), point.availableDischargeMw ?? 0]));
  const dispatch = roundedPowerAxis(extent);
  return { facility, dispatch: { maximum: dispatch.maximum,
    ticks: [-dispatch.maximum, -dispatch.maximum / 2, 0, dispatch.maximum / 2, dispatch.maximum] } };
}

/** Responsive tick density without resampling or dropping solver intervals. */
export function batteryTimeTicks(start: number, end: number, compact: boolean) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const count = compact ? 4 : 8;
  return Array.from({ length: count + 1 }, (_, index) => start + (end - start) * index / count);
}
