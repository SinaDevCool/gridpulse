import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { OperationsOverviewModel, OperationsScenarioKind } from "./scenario-engine";
import { OperationsEvidenceBadge } from "./components";
import { formatDurationFromIntervals, formatMw, formatMwh } from "./visualization";
import { formatOperationsTime } from "./presentation";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function humanConstraint(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function OperationsDecisionBrief({
  model,
  selected = "battery_workload",
}: {
  model: OperationsOverviewModel;
  selected?: OperationsScenarioKind;
}) {
  const peak = model.intervals.reduce((current, interval) =>
    interval.baselineDemandMw > current.baselineDemandMw ? interval : current,
  );
  const envelope =
    model.operatingEnvelope.intervals.find((interval) => interval.timestamp === peak.timestamp) ??
    model.operatingEnvelope.intervals[0];
  const requiredMw = Math.max(0, peak.baselineDemandMw - envelope.directCeilingMw);
  const key =
    selected === "baseline"
      ? "baselineDemandMw"
      : selected === "battery"
        ? "batteryDemandMw"
        : selected === "workload"
          ? "workloadDemandMw"
          : "combinedDemandMw";
  const selectedResponseMw = Math.max(0, peak.baselineDemandMw - peak[key]);
  const residualMw = Math.max(
    0,
    ...model.intervals.map((point) => point[key] - envelope.directCeilingMw),
  );
  const firstAffected = model.intervals.find(
    (point) => point.baselineDemandMw > envelope.directCeilingMw + 0.01,
  );
  const selectedSummary = model.summaries.find((summary) => summary.kind === selected);
  const state =
    residualMw > 0.01 || !selectedSummary?.feasible
      ? "infeasible"
      : requiredMw > 0.01
        ? "response"
        : "direct";
  const title =
    residualMw > 0.01
      ? `Selected response leaves a ${formatMw(residualMw)} shortfall to the safety target`
      : (selectedSummary?.unresolvedWorkMwh ?? 0) > 0.001
        ? `Power target met, but ${formatMwh(selectedSummary!.unresolvedWorkMwh)} of deferred work remains unrecovered`
        : state === "infeasible"
          ? "Power target met, but reserve or recovery constraints remain unresolved"
          : state === "response"
            ? "Aggregate response fits the target; job-level validation is still required"
            : "Demand remains inside the direct operating envelope";

  return (
    <article className={`operations-decision-brief operations-decision-brief--${state}`}>
      <div className="operations-decision-message">
        <span className="operations-decision-icon" aria-hidden="true">
          {state === "infeasible" ? (
            <AlertTriangle />
          ) : state === "response" ? (
            <ShieldCheck />
          ) : (
            <CheckCircle2 />
          )}
        </span>
        <div>
          <p className="context-label">Assessed peak · {formatOperationsTime(peak.timestamp)}</p>
          <h3>{title}</h3>
          <p>
            {state === "direct"
              ? `The peak remains below the ${formatMw(envelope.directCeilingMw)} safety target.`
              : `First affected interval: ${firstAffected ? formatOperationsTime(firstAffected.timestamp) : "none"}. Review the selected response below.`}
          </p>
        </div>
      </div>
      <dl className="operations-decision-facts">
        <div>
          <dt>Required</dt>
          <dd>{formatMw(requiredMw)}</dd>
        </div>
        <div>
          <dt>Selected response</dt>
          <dd>{formatMw(selectedResponseMw)}</dd>
        </div>
        <div>
          <dt>Target shortfall</dt>
          <dd>{formatMw(residualMw)}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{model.mode === "scenario" ? "Scenario only" : "Review provenance"}</dd>
        </div>
      </dl>
      <p className="operations-decision-statuses">
        <span>Power: {residualMw > 0.01 ? "Target not met" : "Target met"}</span>
        <span>
          Recovery:{" "}
          {(selectedSummary?.unresolvedWorkMwh ?? 0) > 0.001
            ? "Unrecovered work · full horizon"
            : selected === "baseline" || selected === "battery"
              ? "No workload shifting"
              : "Aggregate only · job validation required"}
        </span>
        <span>Evidence: {model.mode === "scenario" ? "Scenario—not live" : "Review inputs"}</span>
      </p>
      <div className="operations-decision-actions">
        <a href="#operations-response">
          {(selectedSummary?.unresolvedWorkMwh ?? 0) > 0.001
            ? "Review recovery"
            : "Review response"}{" "}
          <ArrowRight aria-hidden="true" />
        </a>
        <a
          href="#operations-assurance"
          onClick={() => {
            const panel = document.getElementById("operations-assurance");
            if (panel instanceof HTMLDetailsElement) panel.open = true;
          }}
        >
          Inspect evidence
        </a>
      </div>
    </article>
  );
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

export function OperationsEvidenceRail({ model }: { model: OperationsOverviewModel }) {
  return (
    <aside className="operations-evidence-rail" aria-label="Evidence and decision authority">
      <div>
        <span>Mode</span>
        <strong>Scenario</strong>
      </div>
      <div>
        <span>Calculation</span>
        <strong>Assessment service</strong>
      </div>
      <div>
        <span>Facility meter</span>
        <strong>Not connected</strong>
      </div>
      <div>
        <span>GPU telemetry</span>
        <strong>Not connected</strong>
      </div>
      <div>
        <span>Battery telemetry</span>
        <strong>Not connected</strong>
      </div>
      <div>
        <span>Authority</span>
        <strong>Read only</strong>
      </div>
      <small>{model.intervals.length} assessed intervals</small>
    </aside>
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
