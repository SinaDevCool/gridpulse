import type { OperationsOverviewModel } from "../scenario-engine";
import { integer, number } from "./presentation";
export function AccessibleIntervalTable({
  model,
  mode,
  timestamp,
  onSelect,
}: {
  model: OperationsOverviewModel;
  mode: "power" | "compute";
  timestamp?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <details className="operations-v2-chart-data">
      <summary>View Chart Data</summary>
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
              {mode === "power" ? (
                <>
                  <th scope="col">Baseline (MW)</th>
                  <th scope="col">Battery Response (MW)</th>
                  <th scope="col">Workload Only (MW)</th>
                  <th scope="col">Combined Response (MW)</th>
                </>
              ) : (
                <>
                  <th scope="col">Active GPUs</th>
                  <th scope="col">Utilisation (%)</th>
                  <th scope="col">GPU Power (MW)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {model.intervals.map((point) => (
              <tr key={point.timestamp} aria-selected={point.timestamp === timestamp}>
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={point.timestamp === timestamp}
                    onClick={() => onSelect(point.timestamp)}
                  >
                    {point.label}
                  </button>
                </th>
                {mode === "power" ? (
                  <>
                    <td>{number.format(point.baselineDemandMw)} MW</td>
                    <td>{number.format(point.batteryDemandMw)} MW</td>
                    <td>{number.format(point.workloadDemandMw)} MW</td>
                    <td>{number.format(point.combinedDemandMw)} MW</td>
                  </>
                ) : (
                  <>
                    <td>{integer.format(point.activeGpuCount)}</td>
                    <td>{number.format(point.utilizationPercent)}%</td>
                    <td>{number.format(point.gpuPowerMw)} MW</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
