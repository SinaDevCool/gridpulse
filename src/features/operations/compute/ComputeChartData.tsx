import type { OperationsOverviewModel } from "../scenario-engine";

import { formatMw } from "../formatting";
import { OperationsTooltipShell, TooltipRow } from "../visualization";

import { number } from "./presentation";
import { formatOperationsTime } from "../presentation";

export function ComputeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <OperationsTooltipShell
      label={typeof label === "number" ? formatOperationsTime(new Date(label).toISOString()) : label}
    >
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={formatMw(item.value ?? 0)}
          tone={
            item.name === "GPU power"
              ? "compute"
              : item.name?.startsWith("Aggregate")
                ? "response"
                : "demand"
          }
          detail="Simulated"
        />
      ))}
    </OperationsTooltipShell>
  );
}

export function ComputeChartData({ model }: { model: OperationsOverviewModel }) {
  return (
    <details className="operations-v2-chart-data">
      <summary>View Full Chart Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Facility Demand (MW)</th>
              <th scope="col">Aggregate Scenario—not a Job Schedule (MW)</th>
              <th scope="col">GPU Power (MW)</th>
            </tr>
          </thead>
          <tbody>
            {model.intervals.map((point) => (
              <tr key={point.timestamp}>
                <th scope="row">{point.label}</th>
                <td>{number.format(point.baselineDemandMw)}</td>
                <td>{number.format(point.combinedDemandMw)}</td>
                <td>{number.format(point.gpuPowerMw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
