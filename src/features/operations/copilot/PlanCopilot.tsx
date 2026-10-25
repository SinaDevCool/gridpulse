import { briefText, formatBriefFact, sectionLabels } from "./brief";
import type { PlanCopilotState } from "./use-plan-copilot";

export function PlanCopilot({ state, current, jobId, onNavigate }: {
  state: PlanCopilotState; current: boolean; jobId?: string;
  onNavigate: (view: "overview" | "compute" | "power") => void;
}) {
  const { brief, busy, error, reviewed, reviewedAt, copied, explain, setReviewed, setCopied, setError } = state;
  return <section className="data-panel ops-plan-copilot" aria-label="Plan copilot" aria-busy={busy}>
    <h2>Plan copilot</h2>
    <p>AI-selected findings · checked against this model · human review required</p>
    {!brief ? <button type="button" className="secondary-button" disabled={!current || !jobId || busy}
      onClick={() => void explain()}>{busy ? "Checking explanation…" : "Explain this plan"}</button> : null}
    {!current ? <p>Inputs changed. Calculate a new plan before requesting an explanation.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {brief && current ? <>
      <div className="ops-brief-sections">{Object.entries(sectionLabels).map(([section, label]) => <section key={section} aria-label={`${label} findings`}>
        <h3>{label}</h3>
        {brief.findings.filter(finding => finding.section === section).map(finding => <div key={finding.id}>
          <p>{finding.text}</p>
          <details><summary>Evidence · {finding.claimType.replaceAll("_", " ")}</summary>
            <dl>{finding.factIds.map(id => {
              const fact = brief.evidence.find(item => item.id === id)!;
              return <div key={id}><dt>{fact.label} <small>[{id}]</small></dt>
                <dd>{formatBriefFact(fact)} · {fact.scope.replaceAll("_", " ")} · {fact.availability.replaceAll("_", " ")}
                  <small>{fact.source.selector}.{fact.source.field}</small>
                  <small>Raw value: {JSON.stringify(fact.value)} {fact.unit}. Comparisons use unrounded values.</small>
                </dd></div>;
            })}</dl>
            {[...new Set(finding.factIds.map(id => brief.evidence.find(fact => fact.id === id)!.source.view))].map(view =>
              <button type="button" className="secondary-button" key={view} onClick={() => onNavigate(view)}>
                View {view === "power" ? "battery" : view === "compute" ? "workload" : "power outcome"} evidence
              </button>)}
          </details>
        </div>)}
      </section>)}</div>
      <h3>Review next</h3><ul>{brief.actions.map(action => <li key={action}>{action}</li>)}</ul>
      <details><summary>Receipt and limitations</summary>
        <p>Assessment {brief.resultFingerprint} · {brief.model} · {brief.generatedAt}</p>
        <ul>{brief.limitations.map(text => <li key={text}>{text}</li>)}</ul>
        <pre>{JSON.stringify(brief.receipt, null, 2)}</pre>
      </details>
      <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed this brief against the plan.</label>
      <small>Review does not authorise equipment control or approve an operational action.</small>
      <button type="button" className="secondary-button" disabled={!reviewed} onClick={() => {
        void navigator.clipboard.writeText(briefText(brief, reviewedAt!)).then(() => setCopied(true)).catch(() => setError("Copy unavailable. Use Download brief."));
      }}>{copied ? "Copied" : "Copy brief"}</button>
      <button type="button" className="secondary-button" disabled={!reviewed} onClick={() => {
        const url = URL.createObjectURL(new Blob([briefText(brief, reviewedAt!)], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "gridpulse-plan-brief.txt";
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download brief</button>
    </> : null}
  </section>;
}
