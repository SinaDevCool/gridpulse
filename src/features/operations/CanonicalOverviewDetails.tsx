import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalBreachMinutes, canonicalChecks, canonicalPowerBalance } from "./canonical-overview";
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
  return <ResponseExplorerFrame label="MILP response explorer" scope="All comparisons & checks: full horizon"
    marginsLabel="Operating margins"
    compare={<><PlanComparison target={a.targetMw} limit={a.limitMw}
      peakLabel="Peak import · full horizon" outcomeLabel="Assessment"
      rows={[
        { id: "baseline", label: "Baseline", peakMw: a.baselinePeakMw, breachMinutes: canonicalBreachMinutes(a, true), outcome: "Submitted reference" },
        { id: "joint", label: "Battery + workload", peakMw: a.planPeakMw, breachMinutes: canonicalBreachMinutes(a, false),
          selected: true, outcome: "Accepted joint MILP replay" },
      ]} />
      <details className="ops-result-help"><summary>About these comparisons</summary>
        <p>Baseline and joint plan share the same submitted model. Battery-only and workload-only alternatives were not solved; heuristic comparisons are not substituted. Peaks may occur at different times.</p>
      </details></>}
    interval={<section className="ops-response-breakdown" aria-label="MILP interval explanation">
      <header><h4>Inspecting interval · {formatOperationsTime(selected.timestamp)}</h4><span>Same-interval contributions</span></header>
      {balance ? <SignedPowerBalance {...balance} /> : <p>Component balance unavailable in this engine result. No contributions have been estimated.</p>}
    </section>}
    margins={<section className="ops-operating-margins" aria-label="Operating margins">
      <h4>Whole-plan peak margins</h4><dl className="ops-margin-pair">
        <div><dt>Peak safety-target margin</dt><dd>{formatMw(a.targetMw - a.planPeakMw)}</dd></div>
        <div><dt>Peak facility-limit margin</dt><dd>{formatMw(a.limitMw - a.planPeakMw)}</dd></div></dl>
      <h4>Selected interval · {formatOperationsTime(selected.timestamp)}</h4><dl className="ops-margin-pair">
        <div><dt>Selected-interval safety-target margin</dt><dd>{formatMw(a.targetMw - selected.gridImportMw)}</dd></div>
        <div><dt>Selected-interval facility-limit margin</dt><dd>{formatMw(a.limitMw - selected.gridImportMw)}</dd></div></dl>
      <p className="ops-result-help">Negative margins mean exceedance. These are operating margins, not additional connection capacity; capacity expansion and causal binding-constraint analysis are not assessed.</p>
    </section>}>
    <CanonicalModelChecks assessment={a} />
  </ResponseExplorerFrame>;
}
