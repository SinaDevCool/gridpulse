import { formatOperationsTime } from "./presentation";

export function IntervalNavigation({
  points,
  timestamp,
  onSelect,
  peak,
}: {
  points: { timestamp: string }[];
  timestamp?: string;
  onSelect: (value: string) => void;
  peak?: string;
}) {
  const index = points.findIndex((point) => point.timestamp === timestamp);
  return (
    <div className="ops-interval-navigation" role="group" aria-label="Inspect interval">
      <button
        type="button"
        disabled={index <= 0}
        onClick={() => onSelect(points[index - 1].timestamp)}
      >
        Previous interval
      </button>
      <label>
        Inspect time{" "}
        <select value={timestamp ?? ""} onChange={(event) => onSelect(event.target.value)}>
          {points.map((point) => (
            <option key={point.timestamp} value={point.timestamp}>
              {formatOperationsTime(point.timestamp, true)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={index < 0 || index >= points.length - 1}
        onClick={() => onSelect(points[index + 1].timestamp)}
      >
        Next interval
      </button>
      {peak ? (
        <button type="button" onClick={() => onSelect(peak)}>
          Return to peak
        </button>
      ) : null}
    </div>
  );
}
