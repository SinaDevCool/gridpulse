import type { CanonicalPresentation } from "./canonical-presentation";
import type { OperationsView } from "./view-contracts";
import { formatMw, formatMwh, formatPercent, formatDurationHours } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { OperationsChartLegend, useChartVisibility } from "./visualization";
import { CanonicalOverviewDetails } from "./CanonicalOverviewDetails";

export function CanonicalAssessmentView({ assessment, view, timestamp, onSelect, preview, onPreview }: {
  assessment: CanonicalPresentation; view: OperationsView; timestamp: string; onSelect: (value: string) => void;
  preview: string | null; onPreview: (value: string | null) => void;
}) {
  const inspected = preview ?? timestamp;
  const selected = assessment.points.find(point => point.timestamp === inspected) ?? assessment.points[0];
  const index = assessment.points.indexOf(selected);
  const previous = assessment.points[Math.max(0, index - 1)].timestamp;
  const next = assessment.points[Math.min(assessment.points.length - 1, index + 1)].timestamp;
  const breachHours = assessment.points.reduce((sum, point) => sum + (point.limitExceedanceMw > 0.01 ? point.durationMinutes! / 60 : 0), 0);
  return <article className="power-timeline-card ops-canonical" data-assessment-id={assessment.projected.identity.resultFingerprint} data-inspected-time={inspected}>
    <header><div><p className="context-label">MILP · synthetic model · read-only</p>
      <h2>{view === "compute" ? "Solved workload schedule" : view === "power" ? "Joint-plan battery response" : "Optimised facility plan"}</h2>
      </div><p className="ops-canonical-status">{assessment.projected.identity.status === "optimal" ? "Optimal within this model" : "Feasible incumbent—not proven optimal"} · Physical replay passed</p>
    </header>
    <CanonicalSummary assessment={assessment} view={view} breachHours={breachHours} />
    {view === "overview" ? <p className="ops-canonical-status">Baseline peak {formatMw(assessment.baselinePeakMw)} → plan peak {formatMw(assessment.planPeakMw)} · Peaks may occur at different times</p> : null}
    <p className="ops-canonical-status">{assessment.points.length} modelled intervals · Full planning horizon · Not measured delivery or equipment control</p>
    <div className="ops-canonical-inspector">
    <button type="button" className="secondary-button" disabled={index === 0} onClick={() => onSelect(previous)}>Previous interval</button>
    <label>Inspect interval <select value={timestamp} onChange={event => onSelect(event.target.value)}>
      {assessment.points.map(point => <option key={point.timestamp} value={point.timestamp}>{formatOperationsTime(point.timestamp)}</option>)}
    </select></label>
    <button type="button" className="secondary-button" disabled={index === assessment.points.length - 1} onClick={() => onSelect(next)}>Next interval</button>
    <button type="button" className="secondary-button" onClick={() => onSelect(assessment.points.reduce((peak, point) => point.gridImportMw > peak.gridImportMw ? point : peak).timestamp)}>Inspect plan peak</button>
    </div>
    <p role="status">{formatOperationsTime(selected.timestamp)} · grid import {formatMw(selected.gridImportMw)} · battery {formatMw(selected.batteryPowerMw ?? 0)}</p>
    <PowerTimeline data={assessment.points} limitMw={assessment.limitMw} targetMw={assessment.targetMw}
      protectedSocPercent={assessment.protectedSocPercent} selectedTimestamp={inspected}
      onSelect={onSelect} mode="scenario" previewing={preview !== null} variant={view === "power" && assessment.batteryAudit ? "battery" : view === "compute" ? "compute" : "overview"}
      showConstraints={false} maximumSocPercent={assessment.batteryAudit?.maximumSocPercent} />
    <div className="ops-canonical-checks" aria-label="Model checks">
      <span>Facility-limit margin: {formatMw(assessment.limitMw - selected.gridImportMw)}</span>
      <span>Safety-target margin: {formatMw(assessment.targetMw - selected.gridImportMw)}</span>
      {assessment.batteryAudit ? <span>SOC {formatPercent(selected.socPercent!)} · reserve {formatPercent(assessment.protectedSocPercent)} · maximum {formatPercent(assessment.batteryAudit.maximumSocPercent)}</span> : <span>No battery in this plan</span>}
    </div>
    {view === "compute" ? <CanonicalExecutionLanes assessment={assessment} timestamp={inspected} onSelect={onSelect} onPreview={onPreview} /> : null}
    {view === "overview" ? <CanonicalOverviewDetails assessment={assessment} index={index} onSelect={onSelect} /> : null}
    <details><summary>How to read this assessment</summary>
      <p>Baseline import is the submitted reference. Facility demand is planned demand before battery response; grid import is after battery response. Peaks may occur at different times.</p>
      <p>Positive battery MW means discharge; negative means charging. SOC uses fixed health-adjusted capacity, not energy above reserve. Hourly intervals do not imply minute-level control.</p>
      <p>Binding-constraint explanation unavailable. The checks above compare returned values with submitted limits; they do not identify which constraint determined the optimum.</p>
    </details>
    <PowerDataTable data={assessment.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp}
      onSelect={onSelect} onPreview={onPreview} mode="scenario" context={view === "power" ? "battery" : view} />
    <details><summary>Technical details · identity & submitted model</summary>
      <p>{assessment.projected.identity.engineVersion} · {assessment.projected.identity.truthClass} · No physical dispatch</p>
      <p>Result: {assessment.projected.identity.resultFingerprint}</p>
      <p>Input: {assessment.projected.identity.inputFingerprint}. PUE is reference-only in component accounting.</p>
      <pre>{JSON.stringify(assessment.request, null, 2)}</pre>
    </details>
  </article>;
}

function CanonicalSummary({ assessment: a, view, breachHours }: { assessment: CanonicalPresentation; view: OperationsView; breachHours: number }) {
  const battery = a.batteryAudit;
  const completed = a.jobs.filter(job => job.points.at(-1)!.remaining_work_hours <= 1e-6).length;
  const discharge = a.points.reduce((sum, point) => sum + Math.max(0, point.batteryPowerMw ?? 0) * point.durationMinutes! / 60, 0);
  const items = view === "power" ? [
    ["Battery energy delivered · AC", formatMwh(discharge)],
    ["End SOC", battery ? formatPercent(a.points.at(-1)!.socPercent!) : "No battery"],
    ["Terminal energy · target", battery ? `${formatMwh(battery.points.at(-1)!.soc_mwh)} / ${formatMwh(battery.terminalTargetMwh)}` : "Not applicable"],
  ] : view === "compute" ? [
    ["Workloads complete · horizon end", `${completed} / ${a.jobs.length}`],
    ["Peak workload power", formatMw(Math.max(...a.points.map(point => point.workloadPowerMw ?? 0)))],
    ["Execution resolution", `${a.points[0].durationMinutes} min`],
  ] : [
    ["Peak reduction · baseline → plan", formatMw(a.baselinePeakMw - a.planPeakMw)],
    ["Plan peak import", formatMw(a.planPeakMw)],
    ["Above facility limit", formatDurationHours(breachHours)],
  ];
  return <dl className="ops-canonical-summary">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

/** Same execution-lane pattern as the qualified synthetic branch, without synthetic-only data. */
function CanonicalExecutionLanes({ assessment, timestamp, onSelect, onPreview }: {
  assessment: CanonicalPresentation; timestamp: string; onSelect: (timestamp: string) => void;
  onPreview: (timestamp: string | null) => void;
}) {
  const visibility = useChartVisibility();
  const start = Date.parse(assessment.points[0].timestamp);
  const span = Date.parse(assessment.points.at(-1)!.endTimestamp!) - start;
  return <section className="compute-window-lanes" aria-label="MILP planned execution">
    <h3>Planned workload execution</h3>
    <p>Solved intervals—not eligibility windows or delivered execution. Interval widths reflect duration.</p>
    <OperationsChartLegend visibility={visibility} items={[
      { label: "Execution", tone: "demand", mark: "bar" },
      { label: "Checkpoint / restart", tone: "response", mark: "bar" },
    ]} />
    <div className="ops-canonical-axis" aria-label="Execution time axis UTC">{[0, .25, .5, .75, 1].map(fraction => <span key={fraction}>{formatOperationsTime(new Date(start + span * fraction).toISOString())}{fraction === 1 ? " · end" : ""}</span>)}</div>
    {assessment.jobs.map(job => <div className="compute-window-lane" key={job.id} data-active={job.points[assessment.points.findIndex(point => point.timestamp === timestamp)]?.power_mw > 0}>
      <strong>{job.id}</strong>
      <div className="compute-lane-track">
        {job.points.map((point, index) => {
          const interval = assessment.points[index];
          return point.power_mw > 0 && visibility.visible(point.checkpoint_or_restart ? "Checkpoint / restart" : "Execution") ?
            <button key={index} type="button" onClick={() => onSelect(interval.timestamp)}
              onMouseEnter={() => onPreview(interval.timestamp)} onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview(interval.timestamp)} onBlur={() => onPreview(null)}
              aria-pressed={timestamp === interval.timestamp}
              aria-label={`${job.id}, ${formatOperationsTime(interval.timestamp)}, ${point.status}, ${formatMw(point.power_mw)}`}
              style={{ position: "absolute", left: `${(Date.parse(interval.timestamp) - start) / span * 100}%`,
                width: `${interval.durationMinutes! * 60_000 / span * 100}%`, top: 2, bottom: 2, padding: 0,
                border: timestamp === interval.timestamp ? "2px solid var(--ops-selection)" : "1px solid transparent",
                background: point.checkpoint_or_restart ? "var(--ops-response)" : "var(--ops-demand)" }} /> : null;
        })}
      </div>
      <ExecutionTiming assessment={assessment} job={job} />
      <small>Selected interval: {job.points[assessment.points.findIndex(point => point.timestamp === timestamp)]?.status ?? "Unavailable"} · {formatMw(job.points[assessment.points.findIndex(point => point.timestamp === timestamp)]?.power_mw ?? 0)} · Remaining work {job.points.at(-1)!.remaining_work_hours.toFixed(1)} h at horizon end</small>
    </div>)}
  </section>;
}

function ExecutionTiming({ assessment, job }: { assessment: CanonicalPresentation; job: CanonicalPresentation["jobs"][number] }) {
  const activity = job.points.filter(point => point.power_mw > 0);
  const first = activity[0];
  const last = activity.at(-1);
  const declared = assessment.request.workloads.find(workload => workload.workload_id === job.id);
  const sla = declared?.sla as { deadline?: unknown } | undefined;
  const deadline = typeof sla?.deadline === "string" ? sla.deadline : null;
  return <p><small>{first && last ? `First activity ${formatOperationsTime(assessment.points[first.interval_index].timestamp)} · Last activity ends ${formatOperationsTime(assessment.points[last.interval_index].endTimestamp!)}` : "No scheduled activity"}
    {deadline ? ` · Declared deadline ${formatOperationsTime(deadline)}` : " · Deadline not supplied"}</small></p>;
}
