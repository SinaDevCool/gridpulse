import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalChecks } from "./canonical-overview";

export function CanonicalModelChecks({ assessment: a }: { assessment: CanonicalPresentation }) {
  const checks = canonicalChecks(a);
  const attention = checks.filter(check => check.state === "failed" || check.state === "unavailable");
  return <section className="ops-obligations ops-model-checks" aria-label="Full-horizon model checks">
    <header><div><p className="context-label">Full planning horizon</p><h3>Model checks</h3></div>
      <span className="ops-review-state">{attention.length ? "Review required" : "Passed within submitted model"}</span></header>
    <ul className="ops-model-check-list">{checks.map(check => <li key={check.id} data-state={check.state}>
      <span>{check.label}</span><strong>{check.value}</strong></li>)}</ul>
    {attention.length ? <p role="status" className="ops-check-attention">{attention.map(check => `${check.label}: ${check.value}`).join(" · ")}</p> : null}
    <details id="operations-recovery"><summary>Review completion & battery details</summary>
      <div className="ops-canonical-obligation-table"><table><caption>Workload completion · full submitted horizon</caption>
        <thead><tr><th scope="col">Workload</th><th scope="col">Remaining work</th><th scope="col">Deadline check</th></tr></thead>
        <tbody>{a.jobs.map(job => <tr key={job.id}><th scope="row">{job.id}</th>
          <td>{(job.endingRemainingWorkHours ?? job.points.at(-1)!.remaining_work_hours).toFixed(2)} work h</td>
          <td>{job.deadlineMet === undefined ? "Unavailable" : job.deadlineMet ? "Met within model" : "Not met"}</td></tr>)}</tbody>
      </table></div>
      <p>Battery reserve, efficiencies and terminal energy are checked against the accepted request. No measured delivery or equipment commands are implied.</p>
      <p>Energy and workload completion checks retain the full horizon when the chart range changes.</p>
    </details>
  </section>;
}
