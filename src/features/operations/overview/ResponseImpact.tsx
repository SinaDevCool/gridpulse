import { formatDurationHours, formatMw } from "../formatting";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { selectBreachSpans, type DemandKey } from "./select-breach-spans";

export function ResponseImpact({
  model,
  selected,
  onSelect,
  points = model.intervals,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (time: string) => void;
  points?: OperationsOverviewModel["intervals"];
}) {
  const key = {
    baseline: "baselineDemandMw",
    battery: "batteryDemandMw",
    workload: "workloadDemandMw",
    battery_workload: "combinedDemandMw",
  } as const;
  const baseline = model.summaries[0];
  const response = model.summaries.find((item) => item.kind === selected)!;
  if (!points.length) return null;
  const first = Date.parse(points[0].timestamp);
  const last = points.at(-1)!;
  const duration = Math.max(
    1,
    Date.parse(last.timestamp) + (last.durationMinutes ?? 0) * 60_000 - first,
  );
  const lanes: { label: string; field: DemandKey; summary: typeof response }[] = [
    { label: "Before response", field: "baselineDemandMw", summary: baseline },
    { label: "Selected response", field: key[selected], summary: response },
  ];
  return (
    <div className="ops-impact-lanes" aria-label="Time above facility limit">
      <p>
        Peak reduced by{" "}
        <strong>{formatMw(Math.max(0, baseline.peakDemandMw - response.peakDemandMw))}</strong> ·
        Difference between assessment-window peaks, which may occur at different times.
      </p>
      {lanes.map(({ label, field, summary: metric }) => {
        return (
          <div className="ops-impact-lane" key={String(label)}>
            <span>
              {String(label)}
              <strong>
                {formatDurationHours(metric.violationHours)} above{" "}
                {formatMw(model.scenario.importLimitMw)}
              </strong>
            </span>
            <div className="ops-impact-track">
              {selectBreachSpans(points, field, model.scenario.importLimitMw).map((span) => (
                <button
                  key={span.timestamp}
                  type="button"
                  className="breach"
                  style={{
                    left: `${((span.start - first) / duration) * 100}%`,
                    width: `${((span.end - span.start) / duration) * 100}%`,
                  }}
                  aria-label={`${String(label)} breach at ${new Date(span.timestamp).toISOString().slice(11, 16)} UTC · ${formatDurationHours(span.minutes / 60)}`}
                  onClick={() => onSelect(span.timestamp)}
                />
              ))}
            </div>
          </div>
        );
      })}
      <small>
        Red segments: breaches in the inspection range. Durations above retain the assessment
        window. Click to inspect the first interval. Missing-duration intervals are not drawn.
      </small>
    </div>
  );
}
