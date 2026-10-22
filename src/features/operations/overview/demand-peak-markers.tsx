import { ReferenceDot } from "recharts";
import type { OperationsOverviewModel } from "../scenario-engine";
import { formatMw } from "../formatting";
import type { DemandKey } from "./select-breach-spans";

/** Returns direct chart primitives so Recharts retains ownership of their coordinates. */
export function demandPeakMarkers(
  model: OperationsOverviewModel,
  key: DemandKey,
  baselineVisible: boolean,
  responseVisible: boolean,
) {
  if (!model.intervals.length) return null;
  const baseline = model.intervals.reduce((best, point) =>
    point.baselineDemandMw > best.baselineDemandMw ? point : best,
  );
  const response = model.intervals.reduce((best, point) => (point[key] > best[key] ? point : best));
  return [
    baselineVisible ? (
      <ReferenceDot
        key="baseline-peak"
        x={baseline.timestamp}
        y={baseline.baselineDemandMw}
        r={4}
        fill="var(--ops-demand)"
        stroke="var(--background)"
        label={{
          value: `Baseline peak ${formatMw(baseline.baselineDemandMw)}`,
          position: "top",
          fill: "var(--ops-demand)",
          fontSize: 12,
        }}
      />
    ) : null,
    responseVisible ? (
      <ReferenceDot
        key="response-peak"
        x={response.timestamp}
        y={response[key]}
        r={4}
        fill="var(--ops-response)"
        stroke="var(--background)"
        label={{
          value: `Response peak ${formatMw(response[key])}`,
          position: "bottom",
          fill: "var(--ops-response)",
          fontSize: 12,
        }}
      />
    ) : null,
  ];
}
