import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalBreachMinutes, canonicalPowerBalance } from "./canonical-overview";
import { SignedPowerBalance } from "./overview/SignedResponseDiagram";
import { formatMw, formatPercent } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { PeakImportGauge } from "./overview/PeakImportGauge";
import { BreachTrack } from "./overview/BreachTrack";
import { selectBreachSpans } from "./overview/select-breach-spans";

export function CanonicalOperatingSummary({ assessment: a }: { assessment: CanonicalPresentation }) {
  return <section className="ops-operating-summary" aria-label="Operating summary">
    <PeakImportGauge peak={a.planPeakMw} target={a.targetMw} limit={a.limitMw}
      maximum={Math.ceil(Math.max(a.limitMw * 1.15, a.baselinePeakMw, a.planPeakMw, 1) / 10) * 10}
      caption="Full-horizon peak · joint MILP · modelled, not live" />
    <div className="ops-headroom-summary"><p className="context-label">Peak safety margin</p>
      <strong>{formatMw(a.targetMw - a.planPeakMw)}</strong><span>Safety target minus plan peak import</span>
      <p>{formatMw(a.limitMw - a.planPeakMw)} margin to facility limit</p>
    </div>
    <div className="ops-plan-status clear"><p className="context-label">Model assessment</p>
      <h3>{a.planPeakMw <= a.targetMw + .01 ? "Power target met" : "Power target not met"}</h3>
      <p>Accepted physical replay · full planning horizon</p>
      <small>Model feasibility, not measured delivery or additional connection capacity.</small>
    </div>
  </section>;
}

export function CanonicalOverviewDetails({ assessment: a, index, onSelect }: {
  assessment: CanonicalPresentation; index: number; onSelect: (time: string) => void;
}) {
  const balance = canonicalPowerBalance(a, index);
  const facts = canonicalAssessmentFacts(a);
  const duration = a.points.reduce((sum, point) => sum + point.durationMinutes!, 0);
  const flag = (value: boolean | null) => value === null ? "Unavailable" : value ? "Passed within model" : "Unresolved";
  return <section aria-label="MILP response explorer">
    <h3>Response explorer</h3>
    <p>Full-horizon comparison · same submitted model · not physical delivery</p>
    <dl className="ops-canonical-summary">
      <div><dt>Peak safety-target margin</dt><dd>{formatMw(a.targetMw - a.planPeakMw)}</dd></div>
      <div><dt>Peak facility-limit margin</dt><dd>{formatMw(a.limitMw - a.planPeakMw)}</dd></div>
      <div><dt>Additional connection capacity</dt><dd>Not assessed</dd></div>
    </dl>
    <div className="ops-canonical-breaches" aria-label="Before and after limit breaches">
      {[true, false].map(baseline => <div key={String(baseline)}>
        <p>{baseline ? "Before response" : "Joint plan"} · {canonicalBreachMinutes(a, baseline)} min above {formatMw(a.limitMw)}</p>
        <BreachTrack spans={selectBreachSpans(a.points, baseline ? "baselineDemandMw" : "gridImportMw", a.limitMw + .01)}
          first={Date.parse(a.points[0].timestamp)} duration={duration * 60_000}
          label={baseline ? "Baseline" : "Plan"} onSelect={onSelect} />
      </div>)}
    </div>
    <details><summary>Explain selected interval · {formatOperationsTime(a.points[index].timestamp)}</summary>
      {balance ? <SignedPowerBalance {...balance} /> : <p>Component balance unavailable in this engine result. No contributions have been estimated.</p>}
    </details>
    <section aria-label="Full-horizon obligations">
      <h3>Remaining obligations</h3>
      <dl className="ops-canonical-summary">
        <div><dt>Recovery & completion</dt><dd>{flag(facts.recoveryComplete)}</dd></div>
        <div><dt>Declared SLA violations</dt><dd>{facts.slaViolations ?? "Unavailable"}</dd></div>
        <div><dt>Battery terminal target</dt><dd>{a.batteryAudit ? flag(facts.terminalTargetsMet) : "Not applicable"}</dd></div>
        <div><dt>Minimum modelled SOC</dt><dd>{a.batteryAudit ? formatPercent(Math.min(a.batteryAudit.initialSocPercent, ...a.points.map(point => point.socPercent!))) : "No battery"}</dd></div>
      </dl>
      <div className="ops-canonical-obligation-table">
        <table><caption>Workload completion · full submitted horizon</caption>
          <thead><tr><th scope="col">Workload</th><th scope="col">Remaining work</th><th scope="col">Deadline check</th></tr></thead>
          <tbody>{a.jobs.map(job => <tr key={job.id}><th scope="row">{job.id}</th>
            <td>{(job.endingRemainingWorkHours ?? job.points.at(-1)!.remaining_work_hours).toFixed(2)} work h</td>
            <td>{job.deadlineMet === undefined ? "Unavailable" : job.deadlineMet ? "Met within model" : "Not met"}</td></tr>)}</tbody>
        </table>
      </div>
      <p>Validated within the submitted model, not delivered execution. Capacity expansion and causal binding-constraint analysis are not supplied by this result.</p>
    </section>
  </section>;
}
