import { useEffect, useRef, useState } from "react";
import { CopilotEvidence } from "./CopilotEvidence";
import { briefText, briefContentDigest, sectionLabels } from "./brief";
import type { PlanCopilotState } from "./use-plan-copilot";
import type { ReactNode } from "react";

export function PlanBrief({ state, current, jobId, onNavigate, children }: {
  state: PlanCopilotState; current: boolean; jobId?: string;
  onNavigate: (view: "overview" | "compute" | "power") => void;
  children?: ReactNode;
}) {
  const { brief, busy, error, reviewed, reviewedAt, copied, explain, setReviewed, setCopied, setError } = state;
  const latestBrief=useRef({brief,reviewed});latestBrief.current={brief,reviewed};
  return <section className="data-panel ops-plan-copilot" aria-label="Plan brief" aria-busy={busy}>
    <h3>Plan brief</h3>
    <p>Explain and inspect this modelled plan · review evidence before a decision</p>
    {!brief ? <button type="button" className="secondary-button" disabled={!current || !jobId || busy}
      onClick={() => void explain()}>{busy ? "Checking explanation…" : "Explain this plan"}</button> : null}
    {!current ? <p>Inputs changed. Calculate a new plan before requesting an explanation.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {brief && current ? <>
      <div className="ops-brief-sections">{Object.entries(sectionLabels).map(([section, label]) => <details key={section} open={section === "summary" || brief.findings.some(f => f.section === section && /not met|unavailable|failed|not proven|: No\./i.test(f.text))}><summary>{label}</summary>
        {brief.findings.filter(finding => finding.section === section).map(finding => <div key={finding.id}>
          <p>{finding.text}</p>
          <CopilotEvidence facts={finding.factIds.map(id => brief.evidence.find(fact => fact.id === id)!)} />
          {[...new Set(finding.factIds.map(id => brief.evidence.find(fact => fact.id === id)!.source.view))].map(view =>
            <button type="button" className="secondary-button" key={view} onClick={() => onNavigate(view)}>
              View {view === "power" ? "battery" : view === "compute" ? "workload" : "power outcome"} evidence
            </button>)}
        </div>)}
      </details>)}</div>
      <h3>Review next</h3><ul>{brief.actions.map(action => <li key={action}>{action}</li>)}</ul>
      {brief.investigation ? <section aria-label="Investigation brief"><h3>Investigation</h3>
        {brief.investigation.result.cases.map(item => <p key={item.case_id}>
          {item.case_id}: {item.mode === "frozen_plan" ? "Accepted schedule held fixed" : "Separate re-optimisation"} — {item.status === "unsupported_or_invalid" ? "Not assessed" : item.accepted ? "Passed supplied model checks" : "Did not pass supplied model checks"}.
        </p>)}<small>Assumed conditions; not a measured delivery or reliability probability.</small>
      </section> : null}
      {brief.guidance?.length ? <details><summary>Report guidance and applicability</summary>
        <p>Editorial guidance; not measured site evidence or engineering approval.</p>
        {brief.guidance.map(guidance => <article key={guidance.id}>
          <h4>{guidance.title}</h4><p>{guidance.text}</p>
          {guidance.applicability ? <p>{guidance.applicability}</p> : null}
          <a href={`${guidance.source}#page=${guidance.pdfPages?.[0] ?? 1}`} target="_blank" rel="noreferrer">Source report · PDF pages {guidance.pdfPages?.join(", ")}</a>
          <small> Revision {guidance.revision ?? guidance.version}</small>
          {guidance.excludedUses?.length ? <ul>{guidance.excludedUses.map(use => <li key={use}>{use}</li>)}</ul> : null}
        </article>)}
      </details> : null}
      <details><summary>Receipt and limitations</summary>
        <p>Assessment {brief.resultFingerprint} · {brief.model} · {brief.generatedAt}</p>
        <ul>{brief.limitations.map(text => <li key={text}>{text}</li>)}</ul>
        <pre tabIndex={0} aria-label="Brief receipt">{JSON.stringify(brief.receipt, null, 2)}</pre>
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
      <button type="button" className="secondary-button" disabled={!reviewed} onClick={async () => {
        try {
        const contentDigest=await briefContentDigest(brief);
        if(latestBrief.current.brief!==brief || !latestBrief.current.reviewed)return;
        const url = URL.createObjectURL(new Blob([JSON.stringify({ brief, contentDigest, reviewAcknowledgedAt: reviewedAt,
          operationalApproval: false }, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "gridpulse-evidence-brief.json";
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { setError("Evidence export unavailable. Please try again."); }
      }}>Download evidence JSON</button>
    </> : null}
    {children}
  </section>;
}


/** The dashboard keeps requests alive when this single presentation panel closes. */
export function PlanCopilot({ state, current, jobId, onNavigate, children, open, onClose, context }: {
  state: PlanCopilotState; current: boolean; jobId?: string; onNavigate: (view: "overview" | "compute" | "power") => void;
  children: ReactNode; open: boolean; onClose: () => void; context: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"conversation" | "brief">("conversation");
  useEffect(() => {
    const node = dialog.current; if (!node) return;
    const media = matchMedia("(min-width: 1800px)");
    function sync() {
      if (!node) return;
      if (node.open) node.close();
      if (open) { if (media.matches) node.show(); else node.showModal(); }
    }
    sync(); media.addEventListener("change", sync);
    return () => { media.removeEventListener("change", sync); if (node.open) node.close(); };
  }, [open]);
  const close = () => { dialog.current?.close(); onClose(); };
  return <dialog ref={dialog} className="ops-copilot-panel" id="plan-copilot" aria-labelledby="copilot-title"
    onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    }}>
    <header className="ops-copilot-header"><div><h2 id="copilot-title">Plan copilot</h2><small>Modelled results · Read-only</small></div>
      <button type="button" className="secondary-button" onClick={close}>Close copilot</button></header>
    <nav className="ops-copilot-tabs" aria-label="Copilot views">
      <button type="button" aria-pressed={tab === "conversation"} onClick={() => setTab("conversation")}>Conversation</button>
      <button type="button" aria-pressed={tab === "brief"} onClick={() => setTab("brief")}>Plan brief</button>
    </nav>
    <div className="ops-copilot-context">{context}</div>
    {!current ? <p role="status" className="ops-copilot-notice">Inputs changed. Calculate a new plan before asking about it.</p> : null}
    <div className="ops-copilot-content" hidden={tab !== "conversation"}>{children}</div>
    <div className="ops-copilot-content ops-copilot-brief" hidden={tab !== "brief"}>
      <PlanBrief state={state} current={current} jobId={jobId} onNavigate={onNavigate} />
    </div>
  </dialog>;
}
