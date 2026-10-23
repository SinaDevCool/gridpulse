import { Upload } from "lucide-react";
import { OperationsSelect } from "../OperationsSelect";
import { formatOperationsTime } from "../presentation";
import { formatMw } from "../formatting";
import { number, type EvidenceMode } from "./presentation";
import { EvidencePill } from "./primitives";
import type { selectPowerView } from "./select-power-view";

export function PowerWorkspaceHeader({
  view,
  mode,
  onSelect,
  onEvidence,
  ready,
}: {
  view: ReturnType<typeof selectPowerView>;
  mode: EvidenceMode;
  onSelect: (timestamp: string) => void;
  onEvidence: () => void;
  ready: boolean;
}) {
  const { series, selectedPoint, workspace, limitMw, targetMw } = view;
  const index = series.findIndex((point) => point.timestamp === selectedPoint?.timestamp);
  return (
    <>
      <header className="power-workspace-heading">
        <div>
          <p className="context-label">Battery Response & Reserve</p>
          <h3>Facility Power & Battery Response</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <div className="power-workspace-tools">
        <div className="power-interval-control">
          <OperationsSelect
            name="power-interval"
            label="Selected interval (UTC)"
            value={selectedPoint?.timestamp ?? ""}
            options={series.map((point) => ({
              value: point.timestamp,
              label: formatOperationsTime(point.timestamp),
            }))}
            onChange={onSelect}
            disabled={!series.length}
          />
          <div className="battery-interval-stepper" aria-label="Interval navigation">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onSelect(series[index - 1].timestamp)}
            >
              Previous interval
            </button>
            <button
              type="button"
              disabled={index < 0 || index >= series.length - 1}
              onClick={() => onSelect(series[index + 1].timestamp)}
            >
              Next interval
            </button>
          </div>
        </div>
        <button type="button" className="secondary-button" onClick={onEvidence} disabled={!ready}>
          <Upload aria-hidden="true" />
          Connect evidence
        </button>
      </div>
      <div className="power-horizon-status" aria-label="Full-horizon battery assessment">
        <span>
          {mode === "scenario" ? "Full horizon · battery only" : "Evidence · observed records"}
        </span>
        {mode === "scenario" ? (
          <>
            <strong data-tone={workspace.targetMet ? "positive" : "warning"}>
              {workspace.targetMet ? "Target met" : "Target unmet"}
            </strong>
            <strong data-tone={workspace.reserveProtected ? "positive" : "warning"}>
              {workspace.reserveProtected
                ? "Reserve protected"
                : "Reserve requirement not satisfied"}
            </strong>
          </>
        ) : (
          <strong>Uploaded observations · feasibility not inferred</strong>
        )}
        <details className="power-context-details">
          <summary>Assessment context</summary>
          <dl className="power-kpis ops-compact-facts">
            <div>
              <dt>Facility limit · assumption</dt>
              <dd>{formatMw(limitMw)}</dd>
            </div>
            <div>
              <dt>Safety target · assumption</dt>
              <dd>{formatMw(targetMw)}</dd>
            </div>
            <div>
              <dt>Discharge time · full horizon</dt>
              <dd>
                {mode === "historical"
                  ? "Not derivable"
                  : workspace.dischargeMinutes > 0
                    ? `${number.format(workspace.dischargeMinutes / 60)} h`
                    : "Not required"}
              </dd>
            </div>
          </dl>
          <p>
            {mode === "scenario"
              ? "Battery-only comparison · workload shifting excluded. Display windows never reset battery state. Full-horizon assessment is separate from the inspected interval."
              : "Uploaded observations only. Missing evidence stays unknown; dispatch constraints and backup autonomy are not inferred."}
          </p>
          <p>
            Positive battery MW means discharge; negative means charge. Scenario SOC is the
            end-of-interval state. Read-only assessment; no equipment commands.
          </p>
        </details>
      </div>
    </>
  );
}
