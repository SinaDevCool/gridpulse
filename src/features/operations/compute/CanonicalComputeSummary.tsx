import { CheckCircle2, CircleAlert } from "lucide-react";
import type { CanonicalComputeModel, ComputeFilter } from "../canonical-compute";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";

export function CanonicalComputeSummary({ model: m, selectedId, onJob }: {
  model: CanonicalComputeModel; selectedId: string | null; onJob: (id: string) => void;
}) {
  const attention = m.jobs.some(job => job.attention);
  const Icon = attention ? CircleAlert : CheckCircle2;
  return <section className="canonical-compute-outcome" aria-label="Workload outcomes">
    <div className="canonical-outcome-main"><Icon aria-hidden="true" data-attention={attention} />
      <div><h2>Solved workload schedule</h2><p><strong>{m.completed} / {m.jobs.length}</strong> workloads complete</p>
        {!m.jobs.length ? <small>No workloads in this assessment</small> : <small>At modelled horizon end</small>}</div></div>
    <dl className="canonical-outcome-facts">
      <div><dt>Deadline checks met</dt><dd>{m.deadlinesMet} / {m.jobs.length}</dd>
        {m.deadlineUnavailable ? <dd className="canonical-unavailable">{m.deadlineUnavailable} unavailable</dd> : null}</div>
      <div><dt>Remaining work</dt><dd>{m.remaining === null ? "Unavailable" : `${m.remaining.toFixed(2)} work h`}</dd></div>
    </dl>
    {m.jobs.length > 0 && m.jobs.length <= 20 ? <div className="canonical-completion-count">
      <span>Completion by workload · select to inspect</span>
      <div className="canonical-completion-segments">{m.jobs.map(job => <button type="button" key={job.id}
        aria-label={`Inspect ${job.name}: ${job.complete === null ? "completion unavailable" : job.complete ? "complete" : "incomplete"}`}
        aria-pressed={selectedId === job.id} onClick={() => onJob(job.id)}
        data-state={job.complete === null ? "unknown" : job.complete ? "complete" : "incomplete"}>
        <span aria-hidden="true">{job.complete === true ? "✓" : job.complete === false ? "!" : "?"}</span>
      </button>)}</div>
      <small>Each segment represents one workload, not an equal amount of work.</small>
    </div> : null}
  </section>;
}

export function CanonicalComputeInterval({ model: m, filter, onFilter }: {
  model: CanonicalComputeModel; filter: ComputeFilter; onFilter: (value: ComputeFilter) => void;
}) {
  const point = m.current;
  const total = point.flexibleMw + point.protectedMw + point.unknownMw;
  const groups = [
    { id: "protected" as const, label: "Protected", mw: point.protectedMw },
    { id: "flexible" as const, label: "Flexible", mw: point.flexibleMw },
    ...(m.jobs.some(job => job.protectedWork === null) ? [{ id: "all" as const, label: "Unclassified", mw: point.unknownMw }] : []),
  ];
  return <section className="canonical-compute-interval" aria-label="Inspected compute interval">
    <div className="canonical-interval-total"><span>{formatOperationsTime(point.timestamp)}–{formatOperationsTime(point.endTimestamp!)}
      {new Date(point.endTimestamp!).getUTCDate() !== new Date(point.timestamp).getUTCDate() ? " · next day" : ""}</span>
      <strong>{formatMw(total)}</strong><span>Scheduled compute · {m.running} running{m.checkpoints ? ` · ${m.checkpoints} checkpoint / restart` : ""}</span></div>
    <div className="canonical-interval-composition">
      <div className="canonical-demand-split" role="img" aria-label={total ? groups.map(group => `${group.label} ${formatMw(group.mw)}`).join(", ") : "No scheduled compute power in this interval"}>
        {groups.map(group => <span key={group.id} data-kind={group.id} style={{ width: `${total ? group.mw / total * 100 : 0}%` }} />)}</div>
      <div className="canonical-split-labels">{groups.map(group => <button type="button" key={group.id}
        data-kind={group.id} aria-pressed={filter === group.id} onClick={() => onFilter(group.id)}
        aria-label={`${group.label} compute ${formatMw(group.mw)}: ${group.id === "all" ? "show all workloads" : `show ${group.id} workloads`}`}>
        <i aria-hidden="true" />{group.label} <strong>{formatMw(group.mw)}</strong></button>)}</div>
    </div>
  </section>;
}
