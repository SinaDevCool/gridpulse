import { useRef } from "react";
import type { CanonicalComputeJob } from "../canonical-compute";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import { useInspectorFocus } from "./use-inspector-focus";

export function CanonicalWorkloadInspector({ job, onClose }: { job: CanonicalComputeJob; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useInspectorFocus(closeRef, onClose);
  const date = (value: string | null | undefined) => value ? formatOperationsTime(value, true) : "Unavailable";
  return <aside className="compute-drawer canonical-workload-inspector" aria-label={`Workload details: ${job.name}`}>
    <header><h3>{job.name}</h3><button type="button" ref={closeRef} onClick={onClose} aria-label="Close workload details">Close</button></header>
    <p>Modelled plan · not delivered execution</p>
    <h4>At inspected interval</h4>
    <dl><div><dt>Status</dt><dd>{job.current.status}</dd></div>
      <div><dt>Workload power</dt><dd>{formatMw(job.current.power_mw)}</dd></div>
      <div><dt>GPU allocation</dt><dd>{job.current.gpu_count.toLocaleString()}</dd></div>
      <div><dt>Remaining work · interval end</dt><dd>{job.current.remaining_work_hours.toFixed(2)} work h</dd></div></dl>
    <h4>Submitted constraints</h4>
    <dl>{[
      ["Earliest start", date(job.earliest)], ["Deadline", date(job.deadline)],
      ["Protection", job.protectedWork === null ? "Unavailable" : job.protectedWork ? "Protected inference" : "Flexible"],
      ["Nominal power", job.nominalPower === null ? "Unavailable" : formatMw(job.nominalPower)],
      ["Minimum power cap", job.minimumPower === null ? "Unavailable" : formatMw(job.minimumPower)],
      ["Declared work duration", job.expectedMinutes === null ? "Unavailable" : `${job.expectedMinutes} min`],
      ["Minimum throughput", job.minimumThroughput === null ? "Unavailable" : `${(job.minimumThroughput * 100).toFixed(0)}%`],
      ["GPU bounds", job.minGpu === null || job.maxGpu === null ? "Unavailable" : `${job.minGpu.toLocaleString()}–${job.maxGpu.toLocaleString()}`],
      ["Maximum start delay", job.maxDelay === null ? "Unavailable" : `${job.maxDelay} min`],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>Solved outcome · full horizon</h4>
    <dl><div><dt>First scheduled activity</dt><dd>{date(job.first)}</dd></div>
      <div><dt>Last activity ends</dt><dd>{date(job.last)}</dd></div>
      <div><dt>Planned completion</dt><dd>{date(job.completionTime)}</dd></div>
      <div><dt>Deadline check</dt><dd>{job.deadlineMet === undefined ? "Unavailable" : job.deadlineMet ? "Met within model" : "Not met"}</dd></div>
      <div><dt>Remaining work · horizon end</dt><dd>{job.remaining === null ? "Unavailable" : `${job.remaining.toFixed(2)} work h`}</dd></div></dl>
  </aside>;
}
