export type RzregMetricKey =
  | "connected_it_kw"
  | "annual_electricity_kwh"
  | "renewable_energy_factor_pct"
  | "pue"
  | "energy_reuse_factor_pct"
  | "cooling_efficiency_ratio"
  | "wue_l_per_kwh_it"
  | "waste_heat_released_kwh"
  | "waste_heat_reused_kwh";

export type RzregPerformanceRecord = {
  id: string;
  name: string;
  operator: string;
  postcode: string;
  size_class: string;
  surface_area_m2: number | null;
  metrics: Record<RzregMetricKey | "connected_non_redundant_kw", number | null>;
  validation_warnings: string[];
};

export type PeerStatistic = { count: number; p25: number; median: number; p75: number };

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const position = (values.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

export function validMetricValues(records: RzregPerformanceRecord[], metric: RzregMetricKey) {
  return records
    .filter((record) => !record.validation_warnings.includes(`${metric}:outside_validation_range`))
    .map((record) => record.metrics[metric])
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function peerStatistic(
  records: RzregPerformanceRecord[],
  metric: RzregMetricKey,
): PeerStatistic {
  const values = validMetricValues(records, metric).sort((a, b) => a - b);
  return {
    count: values.length,
    p25: Number(percentile(values, 0.25).toFixed(2)),
    median: Number(percentile(values, 0.5).toFixed(2)),
    p75: Number(percentile(values, 0.75).toFixed(2)),
  };
}

export function selectPeers(records: RzregPerformanceRecord[], itLoadMw: number) {
  const targetKw = Math.max(1, itLoadMw * 1_000);
  const bounded = records.filter((record) => {
    const value = record.metrics.connected_it_kw;
    return value !== null && value >= targetKw / 2 && value <= targetKw * 2;
  });
  return bounded.length >= 12 ? bounded : records;
}
