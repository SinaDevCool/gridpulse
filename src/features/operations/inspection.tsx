import { formatOperationsTime } from "./presentation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, CornerUpLeft } from "lucide-react";

export function IntervalNavigation({
  points,
  timestamp,
  onSelect,
  peak,
  peakLabel = "Return to peak",
}: {
  points: { timestamp: string }[];
  timestamp?: string;
  onSelect: (value: string) => void;
  peak?: string;
  peakLabel?: string;
}) {
  const index = points.findIndex((point) => point.timestamp === timestamp);
  const [query, setQuery] = useState("");
  return (
    <div className="ops-interval-navigation" role="group" aria-label="Inspect interval">
      <button
        type="button"
        aria-label="Previous interval"
        disabled={index <= 0}
        onClick={() => onSelect(points[index - 1].timestamp)}
      >
        <ChevronLeft aria-hidden="true" /> Previous
      </button>
      <details
        className="ops-time-picker"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
        onToggle={(event) => {
          if (event.currentTarget.open)
            event.currentTarget
              .querySelector('button[aria-pressed="true"]')
              ?.scrollIntoView({ block: "nearest" });
        }}
      >
        <summary>
          <Clock3 aria-hidden="true" />
          <span>
            Inspect time · {timestamp ? formatOperationsTime(timestamp, true) : "Unavailable"} ▾
          </span>
        </summary>
        <div className="ops-time-menu">
          <label>
            Find time (UTC)
            <input
              type="search"
              name="inspection-time-search"
              autoComplete="off"
              spellCheck={false}
              placeholder="08:15…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="ops-time-list">
            {points
              .filter((point) =>
                formatOperationsTime(point.timestamp, true)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((point) => (
                <button
                  key={point.timestamp}
                  type="button"
                  aria-pressed={timestamp === point.timestamp}
                  onClick={(event) => {
                    onSelect(point.timestamp);
                    const details = event.currentTarget.closest("details");
                    if (details) {
                      details.open = false;
                      details.querySelector("summary")?.focus();
                    }
                  }}
                >
                  {formatOperationsTime(point.timestamp, true)}{" "}
                  {point.timestamp === peak ? "· Peak" : ""}
                </button>
              ))}
            {!points.some((point) =>
              formatOperationsTime(point.timestamp, true)
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) ? (
              <p>No available intervals match.</p>
            ) : null}
          </div>
        </div>
      </details>
      <button
        type="button"
        aria-label="Next interval"
        disabled={index < 0 || index >= points.length - 1}
        onClick={() => onSelect(points[index + 1].timestamp)}
      >
        Next <ChevronRight aria-hidden="true" />
      </button>
      {peak ? (
        <button type="button" onClick={() => onSelect(peak)}>
          <CornerUpLeft aria-hidden="true" /> {peakLabel}
        </button>
      ) : null}
    </div>
  );
}
