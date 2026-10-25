import { briefText } from "./brief";
import type { PlanCopilotState } from "./use-plan-copilot";

export function PlanCopilot({ state, current, jobId }: {
  state: PlanCopilotState; current: boolean; jobId?: string;
}) {
  const { brief, busy, error, reviewed, copied, explain, setReviewed, setCopied, setError } = state;
  return <section className="data-panel ops-plan-copilot" aria-label="Plan copilot" aria-busy={busy}>
    <h2>Plan copilot</h2>
    <p>AI-selected findings from this calculation. Numbers and statements are checked against the accepted model.</p>
    {!brief ? <button type="button" className="secondary-button" disabled={!current || !jobId || busy}
      onClick={() => void explain()}>{busy ? "Checking explanation…" : "Explain this plan"}</button> : null}
    {!current ? <p>Inputs changed. Calculate a new plan before requesting an explanation.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {brief && current ? <>
      <ul>{brief.findings.map(fact => <li key={fact.id}>{fact.text} <small>[{fact.id}]</small></li>)}</ul>
      <h3>Review next</h3><ul>{brief.actions.map(action => <li key={action}>{action}</li>)}</ul>
      <details><summary>Evidence and limitations</summary>
        <p>Assessment {brief.resultFingerprint} · {brief.model} · {brief.generatedAt}</p>
        <ul>{brief.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </details>
      <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed this brief against the plan.</label>
      <button type="button" className="secondary-button" disabled={!reviewed} onClick={() => {
        void navigator.clipboard.writeText(briefText(brief)).then(() => setCopied(true)).catch(() => setError("Copy unavailable. Use Download brief."));
      }}>{copied ? "Copied" : "Copy brief"}</button>
      <button type="button" className="secondary-button" disabled={!reviewed} onClick={() => {
        const url = URL.createObjectURL(new Blob([briefText(brief)], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "gridpulse-plan-brief.txt";
        link.click(); URL.revokeObjectURL(url);
      }}>Download brief</button>
    </> : null}
  </section>;
}
