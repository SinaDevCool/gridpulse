import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalBreachMinutes, canonicalChecks, canonicalPowerBalance, canonicalMargins } from "./canonical-overview";
import { SignedPowerBalance } from "./overview/SignedResponseDiagram";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { PeakImportGauge } from "./overview/PeakImportGauge";
import { ResponseExplorerFrame } from "./overview/ResponseExplorerFrame";
import { PlanComparison } from "./overview/PlanComparison";
import { CanonicalModelChecks } from "./CanonicalModelChecks";

export function CanonicalOperatingSummary({ assessment: a }: { assessment: CanonicalPresentation }) {
  const attention = canonicalChecks(a).some(check => check.state === "failed" || check.state === "unavailable");
  const met = a.planPeakMw <= a.targetMw + .01;
  const margin = a.targetMw - a.planPeakMw;
  return <section className="ops-operating-summary" aria-label="Operating summary">
    <PeakImportGauge peak={a.planPeakMw} target={a.targetMw} limit={a.limitMw}
      maximum={Math.ceil(Math.max(a.limitMw * 1.15, a.baselinePeakMw, a.planPeakMw, 1) / 10) * 10}
      caption="Full-horizon peak · optimised plan" />
    <div className="ops-headroom-summary"><p className="context-label">Peak safety margin</p>
      <strong>{formatMw(margin)}</strong><span>{margin < 0 ? "Shortfall to safety target" : "Below safety target"}</span>
      <div className="ops-headroom-track" aria-hidden="true"><i className={margin < 0 ? "negative" : "positive"}
        style={{ width: `${Math.min(50, Math.abs(margin) / Math.max(a.limitMw, 1) * 100)}%` }} /></div>
      <p>{formatMw(Math.abs(a.limitMw - a.planPeakMw))} {a.planPeakMw > a.limitMw ? "above" : "below"} facility limit</p>
    </div>
    <div className={`ops-plan-status ${met && !attention ? "clear" : "attention"}`}>
      <p className="context-label">Model assessment · full horizon</p>
      <h3>{met ? "Power target met" : "Power target not met"}</h3>
      <p>{attention ? "Review unresolved or unavailable checks below" : "Workload & battery checks passed"}</p>
      <small>Replay verified · not physical execution</small>
    </div>
  </section>;
}

export function CanonicalOverviewDetails({ assessment: a, index }: { assessment: CanonicalPresentation; index: number }) {
  const balance = canonicalPowerBalance(a, index);
  const selected = a.points[index];
  return <><ResponseExplorerFrame label="MILP response explorer" scope="Modelled assessment · not physical execution"
    compareLabel="Plan comparison" intervalLabel="Interval breakdown" marginsLabel="Operating margins"
    compare={<><PlanComparison target={a.targetMw} limit={a.limitMw}
      peakLabel="Peak import · full horizon" outcomeLabel="Assessment"
      rows={[
        { id: "baseline", label: "Baseline", tone: "baseline", peakMw: a.baselinePeakMw, breachMinutes: canonicalBreachMinutes(a, true), outcome: "Submitted reference" },
        { id: "joint", label: "Joint plan", tone: "plan", peakMw: a.planPeakMw, breachMinutes: canonicalBreachMinutes(a, false),
          selected: true, outcome: "Accepted joint MILP replay" },
      ]} />
      <details className="ops-result-help"><summary>About these comparisons</summary>
        <p>Baseline and joint plan share the same submitted model. Battery-only and workload-only alternatives were not solved; heuristic comparisons are not substituted. Peaks may occur at different times.</p>
      </details></>}
    interval={<section className="ops-response-breakdown" aria-label="MILP interval explanation">
      <header><div><h4>{formatOperationsTime(selected.timestamp)}–{formatOperationsTime(selected.endTimestamp!)}{new Date(selected.endTimestamp!).getUTCDate() !== new Date(selected.timestamp).getUTCDate() ? " · next day" : ""}</h4>
        <p className="ops-interval-balance-total">{formatMw(a.projected.overview.baseline[index].grid_import_mw)} baseline <span aria-hidden="true">→</span><span className="sr-only"> to </span> {formatMw(selected.gridImportMw)} grid import</p></div><span>Same-interval accounting</span></header>
      {balance ? <SignedPowerBalance {...balance} presentation="canonical" /> : <p>Component balance unavailable in this engine result. No contributions have been estimated.</p>}
    </section>}
    margins={<section className="ops-operating-margins" aria-label="Operating margins">
      <div className="ops-margin-table-wrap"><table className="ops-margin-table"><caption>Operating margins · positive is below threshold; negative is exceedance</caption>
        <thead><tr><th scope="col">Scope</th><th scope="col">Safety target {formatMw(a.targetMw)}</th><th scope="col">Facility limit {formatMw(a.limitMw)}</th></tr></thead>
        <tbody>{canonicalMargins(a, index).map(row => <tr key={row.id}><th scope="row">{row.label}{row.id === "interval" ? <small>{formatOperationsTime(selected.timestamp)}–{formatOperationsTime(selected.endTimestamp!)}</small> : <small>Full horizon</small>}</th>
          {[row.safety, row.facility].map((value, column) => <td key={column} data-label={column === 0 ? `Safety target ${formatMw(a.targetMw)}` : `Facility limit ${formatMw(a.limitMw)}`} data-state={value < -.01 ? "exceeded" : value > .01 ? "below" : "at"}>
            <strong>{formatMw(value)}</strong><small>{value < -.01 ? "Exceeds threshold" : value > .01 ? "Below threshold" : "At threshold"}</small></td>)}</tr>)}</tbody>
      </table></div><p className="ops-result-help">Operating margins—not additional connection capacity.</p>
    </section>} />
    <CanonicalModelChecks assessment={a} /></>;
}
