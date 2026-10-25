import { useState } from "react";
import { formatBriefFact } from "./brief";
import type { PlanConversationState } from "./use-plan-conversation";
import type { CopilotNavigation } from "./conversation-contracts";

export function PlanConversation({ state, enabled, context, onNavigate }: { state: PlanConversationState;
  enabled: boolean; context: CopilotNavigation; onNavigate: (target: CopilotNavigation) => void }) {
  const [question, setQuestion] = useState("");
  const suggestions = context.view === "power" ? ["When is battery reserve lowest?", "Explain terminal energy."] :
    context.view === "compute" ? ["Which workloads run at the selected interval?", "Are all workloads complete?"] :
      ["What did this plan achieve?", "When is grid import highest?"];
  const send = () => { void state.ask(question).then(ok => { if (ok) setQuestion(""); }); };
  return <section className="ops-plan-conversation" aria-label="Ask about this plan">
    <h3>Ask about this plan</h3>
    <p>Inspect modelled results and assumptions. Alternatives need a new calculation.</p>
    <div className="ops-chat-suggestions">{suggestions.map(text => <button className="secondary-button" type="button" key={text}
      disabled={!enabled || !!state.pending} onClick={() => setQuestion(text)}>{text}</button>)}</div>
    <div className="ops-chat-transcript" role="log" tabIndex={0} aria-label="Plan conversation" aria-live="polite" aria-relevant="additions">
      {state.turns.map((turn, index) => <article key={index} aria-label={`Answer ${index + 1}`}>
        <h4>{turn.question}</h4>
        <small>{turn.answer.basis === "general_explanation" ? "General explanation" : turn.answer.kind === "answer" ? "Checked model evidence" : turn.answer.kind.replaceAll("_", " ")}</small>
        {turn.answer.blocks.map((block, i) => <p key={i}>{block}</p>)}
        {turn.answer.navigation.map((target, i) => <button type="button" className="secondary-button" key={i} onClick={() => onNavigate(target)}>
          Show {target.workloadId ? "workload" : target.view === "power" ? "battery interval" : target.view === "compute" ? "interval workloads" : "power outcome"}
        </button>)}
        <details><summary>Answer evidence and receipt</summary>
          <dl>{turn.answer.evidence.map(fact => <div key={fact.id}><dt>{fact.label}</dt><dd>{formatBriefFact(fact)}
            <small>{fact.source.selector}.{fact.source.field} · {fact.availability} · raw {JSON.stringify(fact.value)} {fact.unit}</small></dd></div>)}</dl>
          <ul>{turn.answer.limitations.map(text => <li key={text}>{text}</li>)}</ul>
          <p>Question interpretation</p><pre tabIndex={0} aria-label="Resolved question">{JSON.stringify(turn.answer.resolvedQuery, null, 2)}</pre>
          <pre tabIndex={0} aria-label="Answer receipt">{JSON.stringify(turn.answer.receipt, null, 2)}</pre>
        </details>
      </article>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); send(); }}>
      <label htmlFor="plan-question">Your question</label>
      <textarea id="plan-question" rows={2} maxLength={1000} value={question} disabled={!enabled || !!state.pending}
        onChange={event => setQuestion(event.target.value)} placeholder="Ask about a workload, interval, battery or limit…" />
      <button className="secondary-button" type="submit" disabled={!enabled || !!state.pending || !question.trim()}>Ask</button>
      {state.pending ? <button className="secondary-button" type="button" onClick={state.stop}>Stop</button> : null}
      {state.turns.length ? <button className="secondary-button" type="button" disabled={!!state.pending} onClick={state.clear}>Clear conversation</button> : null}
    </form>
    {state.pending ? <p role="status">Checking: {state.pending}</p> : null}
    {state.error ? <p role="alert">{state.error} Your question is retained; use Ask to retry.</p> : null}
    <small>Conversation stays in this browser session and resets when the plan changes. Brief review does not acknowledge later conversation answers.</small>
  </section>;
}
