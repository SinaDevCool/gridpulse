import { formatBriefFact } from "./brief";
import type { BriefFact } from "./contracts";

/** Shared presentation only: accepted evidence supplies every value. */
export function CopilotEvidence({ facts, onNavigate }: { facts: BriefFact[]; onNavigate?: (target: import("./conversation-contracts").CopilotNavigation)=>void }) {
  return <details className="ops-copilot-sources"><summary>Sources · {facts.length}</summary>
    <dl>{facts.map(fact => <div key={fact.id}><dt>{fact.label}</dt>
      <dd>{formatBriefFact(fact)}<small>{fact.scope.replaceAll("_", " ")} · {fact.availability.replaceAll("_", " ")}</small>{onNavigate ? <button type="button" className="secondary-button" onClick={()=>onNavigate({view:fact.source.view,timestamp:null,workloadId:null})}>Inspect supporting view</button> : null}</dd></div>)}</dl>
    <details><summary>Technical sources</summary>{facts.map(fact => <p key={fact.id}>
      <code>{fact.id}</code><small>{fact.source.selector}.{fact.source.field}</small>
      Raw value: {JSON.stringify(fact.value)} {fact.unit}. Comparisons use unrounded values.
    </p>)}</details>
  </details>;
}
