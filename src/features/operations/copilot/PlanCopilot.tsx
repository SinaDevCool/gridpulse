import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";
import { briefSchema, briefText, type PlanBrief } from "./brief";

export function PlanCopilot({ jobId, fingerprint, current }: {
  jobId?: string; fingerprint: string; current: boolean;
}) {
  const [brief, setBrief] = useState<PlanBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const identity = `${jobId}:${fingerprint}:${current}`;
  useEffect(() => {
    setBrief(null); setReviewed(false); setError(null); setBusy(false); setCopied(false);
    return () => controller.current?.abort();
  }, [identity]);
  async function explain() {
    if (!current || !jobId || busy || brief) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(null);
    try {
      const { data: { session } } = await (publicMilpEnabled() ? publicMilpClient() : supabase).auth.getSession();
      if (!session) throw new Error("Run a calculation to establish a session first.");
      const response = await fetch("/api/operations/brief", { method: "POST",
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(80_000)]),
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ jobId, resultFingerprint: fingerprint }) });
      const raw = await response.json();
      if (!response.ok) throw new Error(raw.error ?? "Explanation unavailable.");
      const accepted = briefSchema.parse(raw);
      if (accepted.resultFingerprint !== fingerprint) throw new Error("Explanation refers to a different plan.");
      if (!abort.signal.aborted) setBrief(accepted);
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Explanation unavailable.");
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <section className="data-panel" aria-label="Plan copilot" aria-busy={busy}>
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
