import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { OperationsEvidenceBadge } from "./components";
import { formatDurationFromIntervals, formatMw, formatMwh } from "./formatting";
import { formatOperationsTime } from "./presentation";
import type { OperationsOverviewModel, OperationsScenarioKind } from "./scenario-engine";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function humanConstraint(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function OperatingEnvelopeMap({ model }: { model: OperationsOverviewModel }) {
  const peak = model.intervals.reduce((current, interval) =>
    interval.baselineDemandMw > current.baselineDemandMw ? interval : current,
  );
  const envelope =
    model.operatingEnvelope.intervals.find((interval) => interval.timestamp === peak.timestamp) ??
    model.operatingEnvelope.intervals[0];
  const maximum = Math.max(envelope.combinedCeilingMw, peak.baselineDemandMw) * 1.08;
  const direct = (envelope.directCeilingMw / maximum) * 100;
  const battery = ((envelope.batteryCeilingMw - envelope.directCeilingMw) / maximum) * 100;
  const workload = ((envelope.combinedCeilingMw - envelope.batteryCeilingMw) / maximum) * 100;
  const infeasible = Math.max(0, 100 - direct - battery - workload);
  const marker = Math.min(99, (peak.baselineDemandMw / maximum) * 100);
  const riskMarker = Math.min(99, (envelope.riskAdjustedCeilingMw / maximum) * 100);

  return (
    <article className="operations-envelope-map" aria-labelledby="operations-envelope-title">
      <header>
        <div>
          <p className="context-label">Operating envelope</p>
          <h3 id="operations-envelope-title">How much demand can this facility support?</h3>
          <p>Capacity is added only when battery and eligible workload response are available.</p>
        </div>
        <div className="operations-envelope-binding">
          <span>Binding constraint</span>
          <strong>{humanConstraint(envelope.bindingConstraint)}</strong>
          <OperationsEvidenceBadge kind="simulated" label={`${envelope.confidence} confidence`} />
        </div>
      </header>
      <div
        className="operations-envelope-scale"
        role="img"
        aria-label={`Direct demand is supported to ${number.format(envelope.directCeilingMw)} megawatts, battery support to ${number.format(envelope.batteryCeilingMw)} megawatts, workload support to ${number.format(envelope.combinedCeilingMw)} megawatts. Assessed peak is ${number.format(peak.baselineDemandMw)} megawatts.`}
      >
        <div className="operations-envelope-bands">
          <span className="direct" style={{ width: `${direct}%` }}>
            <b>Direct</b>
            <small>{formatMw(envelope.directCeilingMw)}</small>
          </span>
          <span className="battery" style={{ width: `${battery}%` }}>
            <b>Battery</b>
            <small>+{formatMw(envelope.batteryCeilingMw - envelope.directCeilingMw)}</small>
          </span>
          <span className="workload" style={{ width: `${workload}%` }}>
            <b>Workload</b>
            <small>+{formatMw(envelope.combinedCeilingMw - envelope.batteryCeilingMw)}</small>
          </span>
          <span className="infeasible" style={{ width: `${infeasible}%` }}>
            <b>Unsupported</b>
          </span>
        </div>
        <span
          className="operations-envelope-risk"
          style={{ left: `${riskMarker}%` }}
          aria-hidden="true"
        >
          <i />
        </span>
        <span
          className="operations-envelope-current"
          style={{ left: `${marker}%` }}
          aria-hidden="true"
        >
          <i />
        </span>
      </div>
      <p className="operations-envelope-caption">
        Linear MW scale · assessed peak {formatMw(peak.baselineDemandMw)} · risk-adjusted ceiling{" "}
        {formatMw(envelope.riskAdjustedCeilingMw)}. Scenario boundaries, not verified connection
        capacity.
      </p>
      <dl className="operations-envelope-details">
        <div>
          <dt>Direct ceiling</dt>
          <dd>{formatMw(envelope.directCeilingMw)}</dd>
        </div>
        <div>
          <dt>Battery ceiling</dt>
          <dd>{formatMw(envelope.batteryCeilingMw)}</dd>
        </div>
        <div>
          <dt>Combined ceiling</dt>
          <dd>{formatMw(envelope.combinedCeilingMw)}</dd>
        </div>
        <div>
          <dt>Flexible energy</dt>
          <dd>{formatMwh(model.recommendation.workloadMwh)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function OperationsLifecycle() {
  return (
    <ol className="operations-lifecycle" aria-label="Operations decision lifecycle">
      <li className="partial">
        <span>1</span>
        <div>
          <strong>Observe</strong>
          <small>Scenario inputs; live evidence pending</small>
        </div>
      </li>
      <li className="active">
        <span>2</span>
        <div>
          <strong>Decide</strong>
          <small>Envelope and response available</small>
        </div>
      </li>
      <li>
        <span>3</span>
        <div>
          <strong>Verify</strong>
          <small>Awaiting delivered-response evidence</small>
        </div>
      </li>
    </ol>
  );
}

export function ScenarioDecisionTable({
  model,
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const battery = model.recommendation.batteryMw;
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  return (
    <div className="operations-scenario-table-wrap">
      <table className="operations-scenario-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Peak</th>
            <th>Exposure</th>
            <th>Battery</th>
            <th>Shifted energy</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {model.summaries.map((summary) => (
            <tr key={summary.kind} className={summary.kind === selected ? "selected" : undefined}>
              <th>
                <button
                  type="button"
                  aria-pressed={summary.kind === selected}
                  disabled={!interactive}
                  onClick={() => onSelect(summary.kind)}
                >
                  {summary.label}
                </button>
              </th>
              <td>{formatMw(summary.peakDemandMw)}</td>
              <td>{formatDurationFromIntervals(summary.violationIntervals)}</td>
              <td>
                {summary.kind === "baseline" || summary.kind === "workload"
                  ? "—"
                  : formatMw(battery)}
              </td>
              <td>
                {summary.kind === "battery_workload"
                  ? formatMwh(model.recommendation.workloadMwh)
                  : summary.kind === "workload"
                    ? formatMwh(
                        model.intervals.reduce(
                          (sum, point) => sum + point.workloadOnlyShiftMw * 0.25,
                          0,
                        ),
                      )
                    : "—"}
              </td>
              <td>
                {summary.unresolvedWorkMwh > 0
                  ? `${formatMwh(summary.unresolvedWorkMwh)} unrecovered`
                  : !summary.feasible && !summary.violationIntervals
                    ? "Constraint or reserve shortfall"
                    : summary.violationIntervals
                      ? `${summary.violationIntervals} intervals`
                      : summary.peakDemandMw >
                          model.scenario.importLimitMw - model.scenario.safetyReserveMw + 0.01
                        ? "Below limit; reserve shortfall"
                        : "Within safety target"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
