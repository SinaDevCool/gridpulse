import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalBreachMinutes, canonicalPowerBalance } from "./canonical-overview";
import { SignedPowerBalance } from "./overview/SignedResponseDiagram";
import { formatMw, formatPercent } from "./formatting";
import { formatOperationsTime } from "./presentation";

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
        <div className="ops-canonical-breach-track">{a.points.map(point => {
          const breach = (baseline ? point.baselineDemandMw! : point.gridImportMw) > a.limitMw + .01;
          return <button type="button" key={point.timestamp} onClick={() => onSelect(point.timestamp)}
            aria-label={`${baseline ? "Baseline" : "Plan"}, ${formatOperationsTime(point.timestamp)}, ${breach ? "above limit" : "within limit"}`}
            data-breach={breach} style={{ flex: point.durationMinutes! / duration }} />;
        })}</div>
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
      <p>Validated within the submitted model, not delivered execution. Capacity expansion and causal binding-constraint analysis are not supplied by this result.</p>
    </section>
  </section>;
}
