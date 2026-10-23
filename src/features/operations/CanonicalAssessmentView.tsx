import type { CanonicalPresentation } from "./canonical-presentation";
import type { OperationsView } from "./view-contracts";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { OperationsChartLegend, useChartVisibility } from "./visualization";

export function CanonicalAssessmentView({ assessment, view, timestamp, onSelect, preview, onPreview }: {
  assessment: CanonicalPresentation; view: OperationsView; timestamp: string; onSelect: (value: string) => void;
  preview: string | null; onPreview: (value: string | null) => void;
}) {
  const inspected = preview ?? timestamp;
  const selected = assessment.points.find(point => point.timestamp === inspected) ?? assessment.points[0];
  return <article className="power-timeline-card" data-assessment-id={assessment.projected.identity.resultFingerprint}>
    <header><p className="context-label">MILP · modelled assessment · read-only</p>
      <h2>{view === "compute" ? "Solved workload schedule" : view === "power" ? "Joint-plan battery response" : "Optimised facility plan"}</h2>
      <p>{assessment.projected.identity.status === "optimal" ? "Optimal" : "Feasible incumbent—not proven optimal"} · {assessment.projected.identity.engineVersion} · physical replay passed</p>
    </header>
    <p>Baseline peak {formatMw(assessment.baselinePeakMw)} → plan peak {formatMw(assessment.planPeakMw)}. Full horizon: {assessment.points.length} intervals.</p>
    <p>Input provenance: {assessment.projected.identity.truthClass}. Not measured delivery, a live forecast or dispatch authorisation. Display windows do not recalculate this plan.</p>
    <label>Inspect interval <select value={timestamp} onChange={event => onSelect(event.target.value)}>
      {assessment.points.map(point => <option key={point.timestamp} value={point.timestamp}>{formatOperationsTime(point.timestamp)}</option>)}
    </select></label>
    <p role="status">{formatOperationsTime(selected.timestamp)} · grid import {formatMw(selected.gridImportMw)} · battery {formatMw(selected.batteryPowerMw ?? 0)}</p>
    <PowerTimeline data={assessment.points} limitMw={assessment.limitMw} targetMw={assessment.targetMw}
      protectedSocPercent={assessment.protectedSocPercent} selectedTimestamp={inspected}
      onSelect={onSelect} mode="scenario" previewing={preview !== null} />
    {view === "compute" ? <CanonicalExecutionLanes assessment={assessment} timestamp={inspected} onSelect={onSelect} /> : null}
    <PowerDataTable data={assessment.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp}
      onSelect={onSelect} onPreview={onPreview} mode="scenario" />
    <details><summary>Assessment identity and submitted model</summary>
      <p>Result: {assessment.projected.identity.resultFingerprint}</p>
      <p>Input: {assessment.projected.identity.inputFingerprint}. PUE is reference-only in component accounting.</p>
      <pre>{JSON.stringify(assessment.request, null, 2)}</pre>
    </details>
  </article>;
}

/** Same execution-lane pattern as the qualified synthetic branch, without synthetic-only data. */
function CanonicalExecutionLanes({ assessment, timestamp, onSelect }: {
  assessment: CanonicalPresentation; timestamp: string; onSelect: (timestamp: string) => void;
}) {
  const visibility = useChartVisibility();
  return <section className="compute-window-lanes" aria-label="MILP planned execution">
    <h3>Planned workload execution</h3>
    <p>Solved intervals—not eligibility windows or delivered execution. Interval widths reflect duration.</p>
    <OperationsChartLegend visibility={visibility} items={[
      { label: "Execution", tone: "demand", mark: "bar" },
      { label: "Checkpoint / restart", tone: "response", mark: "bar" },
    ]} />
    {assessment.jobs.map(job => <div className="compute-window-lane" key={job.id}>
      <strong>{job.id}</strong>
      <div className="compute-lane-track">
        {job.points.map((point, index) => {
          const interval = assessment.points[index];
          const start = Date.parse(assessment.points[0].timestamp);
          const span = Date.parse(assessment.points.at(-1)!.endTimestamp!) - start;
          return point.power_mw > 0 && visibility.visible(point.checkpoint_or_restart ? "Checkpoint / restart" : "Execution") ?
            <button key={index} type="button" onClick={() => onSelect(interval.timestamp)}
              aria-pressed={timestamp === interval.timestamp}
              aria-label={`${job.id}, ${formatOperationsTime(interval.timestamp)}, ${point.status}, ${formatMw(point.power_mw)}`}
              style={{ position: "absolute", left: `${(Date.parse(interval.timestamp) - start) / span * 100}%`,
                width: `${interval.durationMinutes! * 60_000 / span * 100}%`, top: 2, bottom: 2, padding: 0,
                border: timestamp === interval.timestamp ? "2px solid var(--ops-selection)" : "1px solid transparent",
                background: point.checkpoint_or_restart ? "var(--ops-response)" : "var(--ops-demand)" }} /> : null;
        })}
      </div>
      <small>Selected interval: {job.points[assessment.points.findIndex(point => point.timestamp === timestamp)]?.status ?? "Unavailable"}</small>
    </div>)}
  </section>;
}
