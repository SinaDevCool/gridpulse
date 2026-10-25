/** Display contracts only: each engine retains its own acceptance and calculation model. */
export type MetricScope = "full_horizon" | "display_range" | "selected_interval";
export type BreachSpan = { start: number; end: number; timestamp: string; minutes: number };
export type OverviewImpact = {
  baselinePeakMw: number; planPeakMw: number; limitMw: number; scope: MetricScope;
  start: number; durationMs: number;
  lanes: { label: string; minutes: number; spans: BreachSpan[] }[];
};
export function peakChange(baseline: number, plan: number) {
  const change = baseline - plan;
  return { label: change < 0 ? "Peak increased by" : "Peak reduced by", magnitude: Math.abs(change) };
}
export function comparisonMaximum(values: number[], target: number, limit: number) {
  return Math.max(1, target, limit, ...values) * 1.08;
}
