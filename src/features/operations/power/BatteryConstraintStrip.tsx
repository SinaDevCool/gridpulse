import type { BatteryTimelinePoint } from "./select-battery-workspace";
import { batteryConstraintSegments, intervalLabel } from "./select-battery-workspace";

export function BatteryConstraintStrip({
  data,
  selectedTimestamp,
  onSelect,
}: {
  data: BatteryTimelinePoint[];
  selectedTimestamp: string | null;
  onSelect: (timestamp: string) => void;
}) {
  const runs = batteryConstraintSegments(data);
  const selectedRun =
    runs.find(
      (run) =>
        selectedTimestamp != null &&
        selectedTimestamp >= run.start &&
        (run.end == null || selectedTimestamp < run.end),
    ) ?? runs[0];
  return (
    <div className="battery-constraint-strip" aria-label="Constraint timeline">
      <span>
        Constraint timeline ·{" "}
        {data[0]?.durationMinutes == null
          ? "observation sequence, not elapsed duration"
          : "elapsed duration"}
      </span>
      <div className="battery-state-band" aria-hidden="true">
        {runs.map((run) => (
          <span
            key={run.start}
            className={`battery-state--${run.code}`}
            style={{ flexGrow: run.minutes || run.count }}
            title={`${run.label} · ${intervalLabel({ timestamp: run.start, endTimestamp: run.end })}`}
          />
        ))}
      </div>
      <label className="battery-table-filter">
        Inspect constraint period
        <select
          value={selectedRun?.start ?? ""}
          disabled={!runs.length}
          onChange={(event) => onSelect(event.target.value)}
        >
          {runs.map((run) => (
            <option key={run.start} value={run.start}>
              {run.label} · {intervalLabel({ timestamp: run.start, endTimestamp: run.end })} ·{" "}
              {run.minutes ? `${run.minutes} min` : `${run.count} observations`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
