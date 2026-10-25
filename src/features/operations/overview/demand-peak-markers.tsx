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
  return powerPeakMarkers(model.intervals, point => point.baselineDemandMw, point => point[key], baselineVisible, responseVisible);
}

export function powerPeakMarkers<T extends { timestamp: string }>(points: T[], baselineValue: (point: T) => number,
  responseValue: (point: T) => number, baselineVisible: boolean, responseVisible: boolean, responseLabel = "Response peak") {
  if (!points.length) return null;
  const baseline = points.reduce((best, point) => baselineValue(point) > baselineValue(best) ? point : best);
  const response = points.reduce((best, point) => responseValue(point) > responseValue(best) ? point : best);
  return [
    baselineVisible ? (
      <ReferenceDot
        key="baseline-peak"
        x={baseline.timestamp}
        y={baselineValue(baseline)}
        r={4}
        fill="var(--ops-demand)"
        stroke="var(--background)"
        label={{
          value: `Baseline peak ${formatMw(baselineValue(baseline))}`,
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
        y={responseValue(response)}
        r={4}
        fill="var(--ops-response)"
        stroke="var(--background)"
        label={{
          value: `${responseLabel} ${formatMw(responseValue(response))}`,
          position: "bottom",
          fill: "var(--ops-response)",
          fontSize: 12,
        }}
      />
    ) : null,
  ];
}
