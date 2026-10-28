import { GuidanceReferences } from "./GuidanceReferences";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatBriefFact } from "./brief";
import { CopilotEvidence } from "./CopilotEvidence";
import { answerBlocks, answerFacts } from "./conversation-presentation";
import type { PlanConversationState } from "./use-plan-conversation";
import type { CopilotNavigation } from "./conversation-contracts";

export function PlanConversation({ state, enabled, context, onNavigate, identity, active, alternative }: { state: PlanConversationState;
  alternative?: ReactNode; enabled: boolean; context: CopilotNavigation; identity: string; active: boolean; onNavigate: (target: CopilotNavigation) => void }) {
  const [question, setQuestion] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [unread, setUnread] = useState(false);
  const [notice, setNotice] = useState("");
  const transcript = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const attempted = useRef("");
  const previous = useRef(identity);
  useEffect(() => {
    if (previous.current === identity) return;
    previous.current = identity; attempted.current = ""; setQuestion(""); setConfirmClear(false); setUnread(false);
    setNotice("New plan loaded. Previous conversation cleared.");
  }, [identity]);
  function latest() {
    const node = transcript.current; if (node) node.scrollTop = node.scrollHeight;
    follow.current = true; setUnread(false);
  }
  useEffect(() => {
    if (follow.current) latest(); else setUnread(true);
  }, [state.turns, state.pending, state.error, active]);
  const suggestions = context.view === "power" ? ["When is battery reserve lowest?", "Explain terminal energy."] :
    context.view === "compute" ? ["Which workloads run at the selected interval?", "Are all workloads complete?"] :
      ["What did this plan achieve?", "When is grid import highest?"];
  const send = () => {
    if (!enabled || state.pending || !question.trim()) return;
    follow.current = true; setNotice(""); attempted.current = question;
    const submitted = question;
    void state.ask(submitted).then(ok => { if (ok) setQuestion(current => current === submitted ? "" : current); });
  };
  return <section className="ops-plan-conversation" aria-label="Ask about this plan">
    <div ref={transcript} className="ops-chat-transcript" tabIndex={0} aria-label="Plan conversation"
      onScroll={event => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; if (follow.current) setUnread(false); }}>
      <h3>Ask about this plan</h3>
      {!state.turns.length ? <><p>Understand the outcome, inspect an interval or review a workload.</p>
        <div className="ops-chat-suggestions">{suggestions.map(text => <button className="secondary-button" type="button" key={text}
          disabled={!enabled || !!state.pending} onClick={() => { setQuestion(text); input.current?.focus(); }}>{text}</button>)}</div>
        <small>Choose a question to edit, then send.</small></> : null}
      {state.turns.map((turn, index) => <article key={`${turn.answer.generatedAt}:${turn.question}:${turn.answer.receipt.providerResponseId ?? index}`} aria-label={`Answer ${index + 1}`}>
        <div className="ops-chat-question"><span className="sr-only">Your question: </span>{turn.question}</div>
        <small>{turn.answer.presentation === "checked_fallback" ? "Checked summary · conversational answer unavailable" : turn.answer.presentation === "grounded_conversation" ? "AI explanation · linked evidence" : turn.answer.basis === "general_explanation" ? "General explanation" : turn.answer.kind === "answer" ? "Checked model evidence" : turn.answer.kind.replaceAll("_", " ")}</small>
        {turn.answer.findings?.length ? turn.answer.findings.map(finding => <div className="ops-checked-finding" data-kind={finding.kind} key={finding.id}>
          {finding.kind === "guidance" ? <small>Report guidance</small> : null}
          <p>{finding.checkedText}</p>
        </div>) : answerBlocks(turn.answer.blocks, turn.answer.evidence, !turn.answer.presentation).map((block, i) => <p key={i}>{block}</p>)}
        {turn.answer.proposalClarification ? <p role="status">{turn.answer.proposalClarification}</p> : null}
        {!turn.answer.presentation && answerFacts(turn.answer.evidence).length ? <dl className="ops-chat-facts">{answerFacts(turn.answer.evidence).map(fact =>
          <div key={fact.id}><dt>{fact.label}</dt><dd>{formatBriefFact(fact)}</dd></div>)}</dl> : null}
        {turn.answer.coverage && turn.answer.coverage.some(part => part.status !== "answer") ? <small role="status">
          {turn.answer.coverage.map(part => `${part.intent.replaceAll("_", " ")}: ${part.status.replaceAll("_", " ")}`).join(" | ")}
        </small> : null}
        {turn.answer.limitations.length ? <details><summary>Scope & limitations</summary><ul className="ops-chat-limitations" aria-label="Answer limitations">{turn.answer.limitations.map(text => <li key={text}>{text}</li>)}</ul></details> : null}
        {turn.answer.navigation.map((target, i) => <button type="button" className="secondary-button" key={i} onClick={() => onNavigate(target)}>
          Inspect {target.workloadId ? "workload" : target.view === "power" ? "battery interval" : target.view === "compute" ? "interval workloads" : "power outcome"}
        </button>)}
        <CopilotEvidence facts={turn.answer.evidence} onNavigate={onNavigate} />
        {turn.answer.investigation ? <details><summary>Investigation | evidence still needed</summary>
          {turn.answer.investigation.hypotheses.map(item => <section key={item.label}><strong>{item.label}</strong><small>Untested hypothesis</small><p>{item.test}</p></section>)}
          <strong>Verify against site evidence</strong><ul>{turn.answer.investigation.requiredEvidence.map(item => <li key={item}>{item}</li>)}</ul>
          {turn.answer.investigation.gaps?.map(gap=><section key={gap.id}><strong>{gap.scope}: {gap.status}</strong><p>{gap.reason}</p><button className="secondary-button" type="button" disabled={!!state.pending} onClick={()=>{setQuestion(gap.question);input.current?.focus();}}>Investigate {gap.scope}</button></section>)}
          <p>{turn.answer.investigation.nextAction}</p>
        </details> : null}
        <GuidanceReferences references={turn.answer.guidance ?? []} describedIds={turn.answer.findings?.flatMap(finding => finding.guidanceRefs.map(ref => ref.id))} />
        <details><summary>Technical receipt</summary>
          {turn.answer.receipt.generation?.stages?.length ? <p>AI stages: {turn.answer.receipt.generation.stages.map(stage => `${stage.stage.replaceAll("_", " ")}: ${stage.provider} · ${stage.servedModel ?? stage.requestedModel}${stage.fallbackReason ? " (fallback)" : ""}`).join(" | ")}</p> : null}
          {turn.answer.findings?.length ? <details><summary>Finding identities & assessment context</summary><pre tabIndex={0}>{JSON.stringify(turn.answer.findings, null, 2)}</pre></details> : null}
          <p>Question interpretation</p><pre tabIndex={0} aria-label="Resolved question">{JSON.stringify(turn.answer.resolvedQueries ?? [turn.answer.resolvedQuery], null, 2)}</pre>
          <pre tabIndex={0} aria-label="Answer receipt">{JSON.stringify(turn.answer.receipt, null, 2)}</pre>
        </details>
      </article>)}
      {alternative}
      {state.turns.length >= 20 ? <small>Showing the latest 20 answers. Recent questions and replies provide follow-up context.</small> : null}
      {state.pending ? <div className="ops-chat-pending"><div className="ops-chat-question">{state.pending}</div><p>Reviewing evidence and preparing your answer…</p></div> : null}
      {state.error ? <div className="ops-chat-error"><div className="ops-chat-question">{attempted.current}</div><p>{state.error}</p><button type="button" disabled={!enabled || !!state.pending} onClick={() => { setQuestion(attempted.current); const submitted = attempted.current; void state.ask(submitted).then(ok => { if (ok) setQuestion(current => current === submitted ? "" : current); }); }}>Retry question</button></div> : null}
    </div>
    <p className="sr-only" role="status">{state.pending ? "Checking plan evidence" : state.error ? state.error : state.turns.length ? "Answer ready" : notice}</p>
    {notice ? <small className="ops-copilot-notice">{notice}</small> : null}
    {unread ? <button type="button" onClick={latest}>New answer</button> : null}
    <form onSubmit={event => { event.preventDefault(); send(); }}>
      <label htmlFor="plan-question">Your question</label>
      <textarea ref={input} id="plan-question" name="plan-question" autoComplete="off" aria-describedby="plan-question-help" rows={2} maxLength={1000}
        value={question} disabled={!enabled} readOnly={!!state.pending} onChange={event => setQuestion(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
        placeholder="Ask about a workload, interval, battery or limit…" />
      <div className="ops-chat-composer-actions"><button className="secondary-button" type="submit" disabled={!enabled || !!state.pending || !question.trim()}>Ask</button>
        {state.pending ? <button className="secondary-button" type="button" onClick={state.stop}>Stop</button> : null}
        {state.turns.length ? <button className="secondary-button" type="button" disabled={!!state.pending} onClick={() => setConfirmClear(true)}>Clear conversation</button> : null}
      </div>
      {confirmClear ? <div role="group" aria-label="Confirm clear conversation"><p>Clear this conversation?</p>
        <button type="button" onClick={() => { state.clear(); setConfirmClear(false); setNotice("Conversation cleared."); input.current?.focus(); }}>Confirm clear</button>
        <button type="button" onClick={() => setConfirmClear(false)}>Keep conversation</button></div> : null}
      <small id="plan-question-help">{question.length}/1000 characters · alternatives require a separate calculation.</small>
      <small>Planning evidence is sent to your configured AI provider.</small>
      <details className="ops-chat-help"><summary>Keyboard, privacy & session details</summary>
        <small>Enter to send; Shift+Enter for a new line. Session only: a new plan clears this conversation. Brief review applies to the brief. AI interprets questions and prioritises checked findings. Equipment control is unavailable.</small>
      </details>
    </form>
  </section>;
}
