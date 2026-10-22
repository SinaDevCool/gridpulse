import { formatDurationHours, formatMw, formatMwh } from "./formatting";
import { formatOperationsTime } from "./presentation";
import type { OperationsOverviewModel, OperationsScenarioKind } from "./scenario-engine";
import { selectPlanObligations } from "./overview/select-plan-obligations";

export function OperatingEnvelopeMap({
  model,
  timestamp,
}: {
  model: OperationsOverviewModel;
  timestamp?: string;
}) {
  const peak =
    model.intervals.find((point) => point.timestamp === timestamp) ??
    model.intervals.reduce<OperationsOverviewModel["intervals"][number] | undefined>(
      (best, point) => (!best || point.baselineDemandMw > best.baselineDemandMw ? point : best),
      undefined,
    );
  const envelope = model.operatingEnvelope.intervals.find(
    (point) => point.timestamp === peak?.timestamp,
  );
  if (!peak || !envelope) return <p>Headroom assessment unavailable.</p>;
  const limits = [
    ["Direct", envelope.directCeilingMw],
    ["With battery", envelope.batteryCeilingMw],
    ["With battery + workload recovery", envelope.combinedCeilingMw],
    ["Assumption-adjusted", envelope.riskAdjustedCeilingMw],
  ] as const;
  const maximum = Math.max(1, peak.baselineDemandMw, ...limits.map(([, value]) => value)) * 1.08;
  return (
    <article className="ops-headroom-detail" aria-labelledby="operations-envelope-title">
      <h3 id="operations-envelope-title">Illustrative response envelope</h3>
      <p>
        {formatOperationsTime(peak.timestamp, true)} · Point-in-time boundaries, not full-horizon
        feasibility or verified connection capacity.
      </p>
      <dl className="ops-envelope-boundaries">
        {limits.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="ops-boundary-track" aria-hidden="true">
                <i style={{ width: `${(100 * value) / maximum}%` }} />
                <b style={{ left: `${(100 * peak.baselineDemandMw) / maximum}%` }} />
              </span>
              <strong>{formatMw(value)}</strong>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Inspected demand marker: {formatMw(peak.baselineDemandMw)}. Combined boundary includes
        recovery demand and may be below the battery boundary.
      </p>
      <p>
        Governing modeled limit:{" "}
        {envelope.bindingConstraint === "contractual_limit"
          ? "Configured import limit"
          : envelope.bindingConstraint.replaceAll("_", " ")}
        . Assumption-based uncertainty; not calibrated confidence.
      </p>
    </article>
  );
}

/** One comparison surface, sharing the chart's response selection and calculation outputs. */
export function ScenarioDecisionTable({
  model,
  fullModel = model,
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  fullModel?: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const limit = model.scenario.importLimitMw;
  const target = limit - model.scenario.safetyReserveMw;
  const maximum = Math.max(1, limit, ...model.summaries.map((s) => s.peakDemandMw)) * 1.08;
  return (
    <div className="ops-response-comparison">
      <p className="ops-comparison-key">
        Shared MW scale · target {formatMw(target)} · limit {formatMw(limit)} · markers shown on
        every row
      </p>
      <div className="operations-scenario-table-wrap">
        <table className="operations-scenario-table ops-compact-comparison">
          <thead>
            <tr>
              <th scope="col">Response</th>
              <th scope="col">Peak import · selected window</th>
              <th scope="col">Above facility limit</th>
              <th scope="col">Unrecovered · full horizon</th>
            </tr>
          </thead>
          <tbody>
            {model.summaries.map((summary) => {
              const recovery = selectPlanObligations(fullModel, summary.kind);
              return (
                <tr
                  key={summary.kind}
                  className={selected === summary.kind ? "selected" : undefined}
                >
                  <th scope="row">
                    <button
                      type="button"
                      aria-label={`Select ${summary.label} comparison`}
                      aria-pressed={selected === summary.kind}
                      onClick={() => onSelect(summary.kind)}
                    >
                      {summary.label}
                    </button>
                  </th>
                  <td>
                    <div className="ops-peak-comparison">
                      <span className="ops-boundary-track" aria-hidden="true">
                        <i style={{ width: `${(100 * summary.peakDemandMw) / maximum}%` }} />
                        <b className="target" style={{ left: `${(100 * target) / maximum}%` }} />
                        <b className="limit" style={{ left: `${(100 * limit) / maximum}%` }} />
                      </span>
                      <strong>{formatMw(summary.peakDemandMw)}</strong>
                    </div>
                  </td>
                  <td>{formatDurationHours(summary.violationHours)}</td>
                  <td>
                    {recovery.unresolved == null
                      ? "Unavailable"
                      : recovery.recoveryRequired
                        ? formatMwh(recovery.unresolved)
                        : "No deferral"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <small>Power compliance alone does not validate reserve protection or job completion.</small>
    </div>
  );
}
