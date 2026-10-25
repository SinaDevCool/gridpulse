import { useCallback, useState, type CSSProperties } from "react";
import type { CanonicalInspectionProps } from "./canonical-view-props";
import { COMPUTE_PLOT, computeFilters, matchesCanonicalCompute, selectCanonicalComputeView, type ComputeFilter } from "./canonical-compute";
import { CanonicalResultDetails } from "./CanonicalResultDetails";
import { IntervalNavigation } from "./inspection";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { CanonicalWorkloadChart } from "./compute/CanonicalWorkloadChart";
import { CanonicalExecutionLanes } from "./compute/CanonicalExecutionLanes";
import { CanonicalWorkloadInspector } from "./compute/CanonicalWorkloadInspector";
import { CanonicalComputeSummary, CanonicalComputeInterval } from "./compute/CanonicalComputeSummary";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";

export function CanonicalComputeView({ assessment: a, timestamp, preview, onSelect, onPreview }: CanonicalInspectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ComputeFilter>("all");
  const [facility, setFacility] = useState(false);
  const [windows, setWindows] = useState(false);
  const close = useCallback(() => setSelectedId(null), []);
  const inspected = preview ?? timestamp;
  const m = selectCanonicalComputeView(a, inspected);
  const selected = m.jobs.find(job => job.id === selectedId);
  const jobs = m.jobs.filter(job => matchesCanonicalCompute(job, filter));
  const selectJob = (id: string) => {
    const job = m.jobs.find(item => item.id === id);
    if (job && !matchesCanonicalCompute(job, filter)) setFilter("all");
    setSelectedId(id); onPreview(null);
  };
  const selectFilter = (value: ComputeFilter) => {
    setFilter(value); if (selected && !matchesCanonicalCompute(selected, value)) close();
  };
  return <section className="operations-v2-view ops-canonical canonical-compute" data-assessment-id={a.projected.identity.resultFingerprint} data-inspected-time={inspected}
    style={{ "--compute-axis-width": `${COMPUTE_PLOT.axisWidth}px`, "--compute-plot-right": `${COMPUTE_PLOT.right}px` } as CSSProperties}>
    <CanonicalComputeSummary model={m} selectedId={selectedId} onJob={selectJob} />
    <p className="ops-canonical-status">Modelled plan · {m.points.length} × {m.points[0].durationMinutes}-minute model intervals · {a.projected.identity.status === "optimal" ? "Optimal within model tolerance" : "Feasible · optimality unproven"}</p>
    <div className="canonical-compute-grid"><article className="power-timeline-card">
      <div className="canonical-compute-toolbar"><h3>When does compute run?</h3>
      <IntervalNavigation points={a.points} timestamp={timestamp} onSelect={onSelect} peak={m.peak} peakLabel="Inspect workload peak" />
      </div>
      <p className="sr-only" role="status" aria-live="polite">Pinned inspection: {formatOperationsTime(timestamp, true)}</p>
      <CanonicalComputeInterval model={m} filter={filter} onFilter={selectFilter} />
      <CanonicalWorkloadChart model={m} selected={selected} timestamp={inspected} onSelect={onSelect} onPreview={onPreview} />
      <div className="canonical-compute-filters" aria-label="Workload review filters">{computeFilters.map(item =>
        <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => selectFilter(item.id)}>{item.label} <strong>{m.jobs.filter(job => matchesCanonicalCompute(job, item.id)).length}</strong></button>)}</div>
      <small>Chart totals cover all workloads; filters apply to the schedule and review table.</small>
      <label className="canonical-window-control"><input type="checkbox" checked={windows} onChange={event => setWindows(event.target.checked)} /> Show earliest-start/deadline envelopes</label>
      <CanonicalExecutionLanes model={m} jobs={jobs} selectedId={selectedId} timestamp={inspected} windows={windows}
        onJob={selectJob} onSelect={onSelect} onPreview={onPreview} />
      <details className="canonical-facility-context" onToggle={event => setFacility(event.currentTarget.open)}><summary>Show facility context</summary>
        {facility ? <PowerTimeline data={a.points} limitMw={a.limitMw} targetMw={a.targetMw} protectedSocPercent={a.protectedSocPercent}
          selectedTimestamp={inspected} onSelect={onSelect} mode="scenario" variant="overview" showConstraints={false} overviewPresentation /> : null}
      </details>
    </article>{selected ? <CanonicalWorkloadInspector job={selected} onClose={close} /> : null}</div>
    <section className="power-timeline-card canonical-compute-review" aria-label="Workload review">
      <h3>Workload review</h3><p>Returned outcomes within the model. Filters also apply to the schedule above.</p>
      <div className="canonical-compute-table"><table><caption className="sr-only">Solved workload outcomes</caption>
        <thead><tr><th scope="col">Workload</th><th scope="col">Protection</th><th scope="col">Power · inspected interval</th><th scope="col">Planned completion</th><th scope="col">Deadline check</th><th scope="col">Remaining · horizon end</th></tr></thead>
        <tbody>{jobs.map(job => <tr key={job.id} data-selected={selectedId === job.id}>
          <th scope="row"><button type="button" aria-pressed={selectedId === job.id} onClick={() => selectJob(job.id)}>{job.name}</button></th>
          <td>{job.protectedWork === null ? "Unavailable" : job.protectedWork ? "Protected" : "Flexible"}</td><td>{formatMw(job.current.power_mw)}</td>
          <td>{job.completionTime ? formatOperationsTime(job.completionTime, true) : "Unavailable"}</td>
          <td>{job.deadlineMet === undefined ? "Unavailable" : job.deadlineMet ? "Met within model" : "Not met"}</td>
          <td>{job.remaining === null ? "Unavailable" : `${job.remaining.toFixed(2)} work h`}</td></tr>)}</tbody></table></div>
      {!jobs.length ? <p>No workloads match this filter.</p> : null}
    </section>
    <details><summary>How to read this schedule</summary><p>Demand groups add to total workload power. A selected workload is already included in that total. Execution gaps remain visible; checkpoint and restart periods may consume no power.</p>
      <p>Completion and deadline checks use the full returned horizon. Flexible denotes non-protected workload classes; submitted bounds still apply. Work-hours describe modelled progress, not electricity in MWh. No per-job baseline shift or causal savings attribution is supplied.</p></details>
    <details><summary>Facility interval context</summary><PowerDataTable data={a.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp}
      onSelect={onSelect} onPreview={onPreview} mode="scenario" context="compute" /></details>
    <CanonicalResultDetails assessment={a} />
  </section>;
}
