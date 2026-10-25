import type { CanonicalComputeJob, CanonicalComputeModel } from "../canonical-compute";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import { OperationsChartLegend, useChartVisibility } from "../visualization";

export function CanonicalExecutionLanes({ model: m, jobs, selectedId, timestamp, windows, onJob, onSelect, onPreview }: {
  model: CanonicalComputeModel; jobs: CanonicalComputeJob[]; selectedId: string | null; timestamp: string; windows: boolean;
  onJob: (id: string) => void; onSelect: (time: string) => void; onPreview: (time: string | null) => void;
}) {
  const visibility = useChartVisibility();
  const position = (time: string) => Math.max(0, Math.min(100, (Date.parse(time) - m.start) / (m.end - m.start) * 100));
  return <section className="compute-window-lanes canonical-execution" aria-label="MILP planned execution">
    <h3>Planned workload execution</h3>
    <p>Modelled schedule, not delivered execution. Select a workload or inspect an interval.</p>
    <OperationsChartLegend visibility={visibility} items={[
      { label: "Flexible execution", tone: "flexible", mark: "bar" },
      { label: "Protected execution", tone: "protected", mark: "bar" },
      { label: "Checkpoint / restart", tone: "response", mark: "bar" },
      { label: "Deadline", tone: "neutral", mark: "dash" },
    ]} />
    <div className="ops-canonical-axis" aria-label="Execution time axis UTC">{[0, .25, .5, .75, 1].map(fraction =>
      <span key={fraction}>{formatOperationsTime(new Date(m.start + (m.end - m.start) * fraction).toISOString())}{fraction === 1 ? " · end" : ""}</span>)}</div>
    {!jobs.length ? <p role="status">No workloads match this filter.</p> : null}
    {jobs.map(job => <div className="compute-window-lane" data-selected={selectedId === job.id} key={job.id} data-workload-id={job.id}>
      <button type="button" className="compute-lane-title" aria-pressed={selectedId === job.id} onClick={() => onJob(job.id)}>
        <strong>{job.name}</strong><span>{job.protectedWork === null ? "Protection unavailable" : job.protectedWork ? "Protected workload" : "Flexible workload"} · {formatMw(job.current.power_mw)} at inspected interval</span>
      </button>
      <div className="compute-lane-track">
        {windows && job.earliest && job.deadline ? <i className="canonical-permitted" aria-hidden="true"
          style={{ left: `${position(job.earliest)}%`, width: `${Math.max(0, position(job.deadline) - position(job.earliest))}%` }} /> : null}
        {job.segments.map(segment => {
          const label = segment.checkpoint_or_restart ? "Checkpoint / restart" : job.protectedWork ? "Protected execution" : "Flexible execution";
          const active = segment.start === timestamp;
          const pointIndex = segment.interval_index;
          return visibility.visible(label) ? <button type="button" key={pointIndex}
            tabIndex={active || (!job.segments.some(item => item.start === timestamp) && segment === job.segments[0]) ? 0 : -1}
            aria-pressed={active} aria-label={`${job.name}, ${formatOperationsTime(segment.start)}, ${segment.status}, ${formatMw(segment.power_mw)}`}
            onClick={() => { onJob(job.id); onSelect(segment.start); }}
            onMouseEnter={() => onPreview(segment.start)} onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(segment.start)} onBlur={() => onPreview(null)}
            onKeyDown={event => {
              const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (offset) { event.preventDefault(); onSelect(m.points[Math.max(0, Math.min(m.points.length - 1, m.index + offset))].timestamp); }
            }}
            data-kind={segment.checkpoint_or_restart ? "checkpoint" : job.protectedWork ? "protected" : job.protectedWork === null ? "unknown" : "flexible"}
            style={{ left: `${position(segment.start)}%`, width: `${position(segment.end) - position(segment.start)}%` }} /> : null;
        })}
        {job.deadline && visibility.visible("Deadline") && Date.parse(job.deadline) >= m.start && Date.parse(job.deadline) <= m.end ?
          <b className="canonical-deadline" title={`Deadline ${formatOperationsTime(job.deadline, true)}`} style={{ left: `${position(job.deadline)}%` }} /> : null}
        <i className="compute-lane-cursor" aria-hidden="true" style={{ left: `${position(timestamp)}%` }} />
      </div>
      <small>{job.completionTime ? `Planned completion ${formatOperationsTime(job.completionTime, true)}` : "Completion time unavailable"} · {job.deadline ? `Deadline ${formatOperationsTime(job.deadline, true)}` : "Deadline unavailable"} · {job.deadlineMet === undefined ? "Check unavailable" : job.deadlineMet ? "Deadline met within model" : "Deadline not met"}</small>
    </div>)}
    {windows ? <small>Earliest-start/deadline envelopes only; duration, delay and other constraints still apply.</small> : null}
  </section>;
}
