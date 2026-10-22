import type { OperationsOverviewModel } from "../scenario-engine";
import { useState } from "react";
import type { WorkloadDecision } from "../workload-intelligence";
import { selectComputeTimeline, workloadTimeRelationship } from "./select-compute-timeline";

import { formatMw } from "../formatting";
import { OperationsTooltipShell, TooltipRow } from "../visualization";

import { number } from "./presentation";
import { formatOperationsTime } from "../presentation";
import { intervalRow } from "../hooks/interval-row";

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
      label={
        typeof label === "number" ? formatOperationsTime(new Date(label).toISOString()) : label
      }
    >
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={formatMw(item.value ?? 0)}
          tone={
            item.name === "GPU power"
              ? "compute"
              : item.name?.startsWith("Aggregate") || item.name === "Required after battery"
                ? "response"
                : "demand"
          }
          detail="Simulated"
        />
      ))}
    </OperationsTooltipShell>
  );
}

export function ComputeChartData({
  model,
  timestamp,
  onSelect,
  onPreview,
  pinnedTimestamp = timestamp,
  selected,
}: {
  model: OperationsOverviewModel;
  timestamp?: string;
  onSelect: (value: string) => void;
  onPreview?: (value: string | null) => void;
  pinnedTimestamp?: string;
  selected?: WorkloadDecision;
}) {
  const [context, setContext] = useState(false);
  const points = selectComputeTimeline(
    model.intervals,
    model.scenario.importLimitMw - model.scenario.safetyReserveMw,
  );
  return (
    <details className="operations-v2-chart-data">
      <summary>View Full Chart Data</summary>
      <label>
        <input
          type="checkbox"
          checked={context}
          onChange={(event) => setContext(event.target.checked)}
        />
        Include facility context columns
      </label>
      <button
        type="button"
        onClick={(event) =>
          event.currentTarget.parentElement
            ?.querySelector('tr[aria-selected="true"]')
            ?.scrollIntoView({ block: "nearest" })
        }
      >
        Jump to selected interval
      </button>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Required after battery (MW)</th>
              <th scope="col">Aggregate shift / recovery (MW)</th>
              <th scope="col">Selected workload window</th>
              {context ? (
                <>
                  <th scope="col">Facility Demand (MW)</th>
                  <th scope="col">Aggregate Scenario—not a Job Schedule (MW)</th>
                  <th scope="col">GPU Power (MW)</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr
                {...intervalRow(point.timestamp, onSelect, onPreview)}
                key={point.timestamp}
                aria-selected={point.timestamp === pinnedTimestamp}
                data-preview={point.timestamp === timestamp && timestamp !== pinnedTimestamp}
              >
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={point.timestamp === timestamp}
                    onClick={() => onSelect(point.timestamp)}
                  >
                    {point.label}
                  </button>
                </th>
                <td>{number.format(point.requiredWorkloadMw)}</td>
                <td>
                  {number.format(point.workloadShiftMw)} / {number.format(point.workloadRecoveryMw)}
                </td>
                <td>{workloadTimeRelationship(selected, point.timestamp)}</td>
                {context ? (
                  <>
                    <td>{number.format(point.baselineDemandMw)}</td>
                    <td>{number.format(point.combinedDemandMw)}</td>
                    <td>{number.format(point.gpuPowerMw)}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
