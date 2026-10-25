import { OperationsSelect } from "../OperationsSelect";
import { SYNTHETIC_RESOLUTION_LABEL } from "../synthetic-milp-request";
import {
  operatingWindowLabels,
  describeDisplayWindow,
  operationsModeLabels,
  type OperatingWindowPreset,
  type OperationsDataMode,
} from "../operating-context";
import { formatOperationsTime } from "../presentation";
import type { OperationsOverviewModel } from "../scenario-engine";
import type { OperationsView } from "../view-contracts";

export function WorkspaceInputs({
  model,
  mode,
  window,
  view,
  onWindow,
  onMode,
  milp = false,
}: {
  model: OperationsOverviewModel;
  mode: OperationsDataMode;
  window: OperatingWindowPreset;
  view: OperationsView;
  onWindow: (value: OperatingWindowPreset) => void;
  onMode: (value: OperationsDataMode) => void;
  milp?: boolean;
}) {
  return (
    <section
      className="ops-workspace-inputs operations-context-strip"
      aria-label="Operating context"
    >
      <div>
        Facility <strong>{model.scenario.facilityName}</strong>
      </div>
      <OperationsSelect
        name="operating-window"
        label={milp ? "Display window (full MILP horizon)" : mode === "historical" ? "Display window (inactive)" : "Display window"}
        disabled={milp || mode === "historical"}
        value={milp ? "today" : window}
        options={Object.entries(operatingWindowLabels)
          .filter(([value]) => value !== "tomorrow")
          .map(([value, label]) => ({
            value: value as OperatingWindowPreset,
            label,
            description:
              value === "now"
                ? "One baseline-peak interval; not the current time"
                : value === "next-4h"
                  ? "Near the first safety-target breach; available data only"
                  : "All available synthetic intervals; not a forecast",
          }))}
        onChange={onWindow}
      />
      <OperationsSelect
        name="data-mode"
        label="Data Mode"
        value={mode}
        options={Object.entries(operationsModeLabels).map(([value, label]) => ({
          value: value as OperationsDataMode,
          label,
          disabled: value === "live" || (value === "historical" && view !== "power"),
          description:
            value === "scenario"
              ? "Configured inputs"
              : value === "historical"
                ? "Power & Battery evidence workspace"
                : "Live connector not connected",
        }))}
        onChange={onMode}
      />
      <span className="ops-context-status">
        {milp ? "Synthetic MILP" : mode === "historical" ? "Historical evidence" : "Scenario"} · Read-only
      </span>
      {mode === "scenario" ? (
        <p role="status">{milp ? `${SYNTHETIC_RESOLUTION_LABEL} · full modelled day` : `${describeDisplayWindow(model, window).split(". ")[0]}.`}</p>
      ) : null}
      <details className="ops-about-assessment">
        <summary>About this assessment</summary>
        <p>
          Display selection does not recalculate the planning horizon. Battery state and unfinished
          work remain full-horizon assessments.
        </p>
        <p>
          Live control unavailable. Historical evidence is displayed in Power & Battery; other views
          remain scenario comparisons.
        </p>
        <small>
          Scenario data:{" "}
          {model.intervals.length
            ? formatOperationsTime(model.intervals[0].timestamp, true)
            : "Unavailable"}{" "}
          –{" "}
          {model.intervals.length
            ? formatOperationsTime(model.intervals.at(-1)!.timestamp)
            : "Unavailable"}
          . Window presets select simulated intervals, not a live forecast.
        </small>
      </details>
    </section>
  );
}
