import { useState } from "react";
import { formatMw, formatPercent } from "../formatting";
import { intervalLabel, type BatteryTimelinePoint } from "./select-battery-workspace";
import type { EvidenceMode } from "./presentation";

type Filter = "all" | "target" | "limit" | "constraint" | "missing";
export function PowerDataTable({
  data,
  selectedTimestamp,
  onSelect,
  mode,
}: {
  data: BatteryTimelinePoint[];
  selectedTimestamp: string | null;
  onSelect: (timestamp: string) => void;
  mode: EvidenceMode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = data.filter(
    (point) =>
      filter === "all" ||
      (filter === "target" && (point.shortfallMw ?? 0) > 0.01) ||
      (filter === "limit" && point.limitExceedanceMw > 0.01) ||
      (filter === "constraint" &&
        !["none", "observed", "missing_evidence"].includes(point.constraintCode)) ||
      (filter === "missing" && point.constraintCode === "missing_evidence"),
  );
  return (
    <details className="operations-v2-chart-data battery-data-details">
      <summary>View Full Interval Data</summary>
      <label className="battery-table-filter">
        Show intervals
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">All intervals</option>
          <option value="target">Target shortfalls</option>
          <option value="limit">Facility-limit breaches</option>
          <option value="constraint">Battery constraints</option>
          <option value="missing">Missing evidence</option>
        </select>
      </label>
      <p aria-live="polite">
        {rows.length} of {data.length} records ·{" "}
        {mode === "scenario" ? "SOC at interval end" : "Observed SOC; no constraint inferred"}
      </p>
      <div
        className="battery-table-scroll"
        role="region"
        aria-label="Battery interval records"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            Power balance and battery evidence. Select a time to inspect it in the shared workspace.
          </caption>
          <thead>
            <tr>
              <th scope="col">Time (UTC)</th>
              <th scope="col">Facility demand (MW)</th>
              <th scope="col">Battery dispatch (MW)</th>
              <th scope="col">Grid import (MW)</th>
              <th scope="col">Start SOC (%)</th>
              <th scope="col">{mode === "scenario" ? "End SOC (%)" : "Observed SOC (%)"}</th>
              <th scope="col">Constraint / evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr
                key={point.timestamp}
                className={point.timestamp === selectedTimestamp ? "selected" : ""}
              >
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={point.timestamp === selectedTimestamp}
                    onClick={() => onSelect(point.timestamp)}
                  >
                    {intervalLabel(point)}
                  </button>
                </th>
                <td>
                  {point.facilityDemandMw == null
                    ? "Unavailable"
                    : formatMw(point.facilityDemandMw)}
                </td>
                <td>
                  {point.batteryPowerMw == null ? "Unavailable" : formatMw(point.batteryPowerMw)}
                </td>
                <td>{formatMw(point.gridImportMw)}</td>
                <td>
                  {point.startingSocPercent == null
                    ? "Unavailable"
                    : formatPercent(point.startingSocPercent)}
                </td>
                <td>
                  {point.socPercent == null ? "Unavailable" : formatPercent(point.socPercent)}
                </td>
                <td>{point.constraintLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p>No records match this filter.</p> : null}
      </div>
    </details>
  );
}
