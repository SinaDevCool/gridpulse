import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalCheckSummary } from "./canonical-overview";
import { CheckCircle2, CircleAlert, CircleHelp, MinusCircle } from "lucide-react";
import { formatPercent } from "./formatting";

export function CanonicalModelChecks({ assessment: a }: { assessment: CanonicalPresentation }) {
  const summary = canonicalCheckSummary(a);
  return <section className="ops-obligations ops-model-checks" aria-label="Full-horizon model checks">
    <header><div><p className="context-label">Full planning horizon</p><h3>Model checks</h3></div>
      <span className="ops-review-state" role="status" data-state={summary.state}>{summary.label}</span></header>
    <ul className="ops-model-check-list">{summary.checks.map(check => {
      const Icon = check.state === "passed" ? CheckCircle2 : check.state === "failed" ? CircleAlert : check.state === "unavailable" ? CircleHelp : MinusCircle;
      return <li key={check.id} data-state={check.state}><Icon aria-hidden="true" />
        <div><span>{check.label}</span><strong>{check.value}</strong></div></li>;
    })}</ul>
    <p className="ops-model-measurement">Minimum modelled SOC <strong>{summary.measurement.value}</strong>
      {a.batteryAudit ? <span> · protected reserve {formatPercent(a.batteryAudit.protectedSocPercent)} · maximum {formatPercent(a.batteryAudit.maximumSocPercent)}</span> : null}</p>
    <details id="operations-recovery"><summary>Review supporting details</summary>
      <div className="ops-canonical-obligation-table" role="region" aria-label="Workload completion evidence" tabIndex={0}><table><caption>Workload completion · full submitted horizon</caption>
        <thead><tr><th scope="col">Workload</th><th scope="col">Remaining work</th><th scope="col">Deadline check</th></tr></thead>
        <tbody>{a.jobs.map(job => <tr key={job.id}><th scope="row">{String(a.request.workloads.find(workload => workload.workload_id === job.id)?.name ?? job.id)}</th>
          <td>{job.endingRemainingWorkHours == null && !job.points.length ? "Unavailable" : `${(job.endingRemainingWorkHours ?? job.points.at(-1)!.remaining_work_hours).toFixed(2)} work h`}</td>
          <td>{job.deadlineMet === undefined ? "Unavailable" : job.deadlineMet ? "Met within model" : "Not met"}</td></tr>)}</tbody>
      </table></div>
      {!a.jobs.length ? <p>No workloads in this assessment.</p> : null}
      <p>Full-horizon model checks retain their scope when inspecting another interval. Modelled assessment—not physical execution. Detailed battery accounting is available in Power & Battery.</p>
    </details>
  </section>;
}
