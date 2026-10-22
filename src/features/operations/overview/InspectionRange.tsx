import type { OperationsOverviewModel } from "../scenario-engine";
export function InspectionRange({
  model,
  range,
  setInspectionRange,
  inspection,
}: {
  model: OperationsOverviewModel;
  range: { startIndex: number; endIndex: number } | null;
  setInspectionRange: (range: { startIndex: number; endIndex: number }) => void;
  inspection: { select: (timestamp: string) => void };
}) {
  return (
    <details className="ops-interval-navigation">
      <summary>Set inspection range</summary>
      <label>
        Range start
        <select
          value={range?.startIndex ?? 0}
          onChange={(event) => {
            const startIndex = Number(event.target.value);
            setInspectionRange({
              startIndex,
              endIndex: Math.max(startIndex, range?.endIndex ?? model.intervals.length - 1),
            });
            inspection.select(model.intervals[startIndex].timestamp);
          }}
        >
          {model.intervals.map((point, index) => (
            <option key={point.timestamp} value={index}>
              {point.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Range end
        <select
          value={range?.endIndex ?? model.intervals.length - 1}
          onChange={(event) => {
            const endIndex = Number(event.target.value);
            const startIndex = Math.min(endIndex, range?.startIndex ?? 0);
            setInspectionRange({ startIndex, endIndex });
            inspection.select(model.intervals[startIndex].timestamp);
          }}
        >
          {model.intervals.map((point, index) => (
            <option key={point.timestamp} value={index}>
              {point.label}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}
