import type { CanonicalPresentation } from "./canonical-presentation";

export function CanonicalResultDetails({ assessment: a, includeGuidance = false }: {
  assessment: CanonicalPresentation; includeGuidance?: boolean;
}) {
  return <details className="ops-result-details"><summary>{includeGuidance ? "Result details & assumptions" : "Technical details · identity & submitted model"}</summary>
    <p>{a.projected.identity.status === "optimal" ? "Optimal within this model" : "Feasible incumbent—not proven optimal"} · Physical replay passed</p>
    {includeGuidance ? <>
      <p>Baseline import is the submitted reference. Planned facility demand is before battery response; grid import is after it. Peaks may occur at different times.</p>
      <p>Positive battery power means discharge; negative means charge. Chart steps represent submitted intervals, not minute-level control. Completion and battery checks retain the full horizon.</p>
      <p>Operating margins are not connection capacity. Causal binding-constraint explanation is not supplied. No measured delivery or physical dispatch is implied.</p>
    </> : null}
    <p>{a.projected.identity.engineVersion} · {a.projected.identity.truthClass} · No physical dispatch</p>
    <p>Result: {a.projected.identity.resultFingerprint}</p><p>Input: {a.projected.identity.inputFingerprint}. PUE is reference-only in component accounting.</p>
    <pre>{JSON.stringify(a.request, null, 2)}</pre>
  </details>;
}
