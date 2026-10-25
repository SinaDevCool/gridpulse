import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";
import { BRIEF_VERSION, briefSchema, type PlanBrief } from "./brief";
import { createBriefRequestLifecycle } from "./request-lifecycle";

export type PlanCopilotState = {
  brief: PlanBrief | null; busy: boolean; error: string | null; reviewed: boolean; reviewedAt: string | null; copied: boolean;
  explain: () => Promise<void>; setReviewed: (value: boolean) => void;
  setCopied: (value: boolean) => void; setError: (value: string | null) => void;
};
export function usePlanCopilot({ jobId, fingerprint, current }: {
  jobId?: string; fingerprint: string; current: boolean;
}): PlanCopilotState {
  const [saved, setSaved] = useState<{ identity: string; brief: PlanBrief } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ identity: string; at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const gate = useRef(createBriefRequestLifecycle());
  const identity = `${jobId}:${fingerprint}:${current}`;
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const brief = saved?.identity === identity && current ? saved.brief : null;
  const reviewedAt = review?.identity === identity && brief ? review.at : null;
  useEffect(() => {
    gate.current.sync(identity);
    setSaved(null); setReview(null); setError(null); setBusy(false); setCopied(false);
    const lifecycle = gate.current;
    return () => lifecycle.cancel();
  }, [identity]);
  async function explain() {
    if (!current || !jobId || brief) return;
    const ticket = gate.current.begin(identity);
    if (!ticket) return;
    setBusy(true); setError(null);
    const accepts = () => gate.current.accepts(ticket, latestIdentity.current);
    try {
      const { data: { session } } = await (publicMilpEnabled() ? publicMilpClient() : supabase).auth.getSession();
      if (!accepts()) return;
      if (!session) throw new Error("Run a calculation to establish a session first.");
      const response = await fetch("/api/operations/brief", { method: "POST",
        signal: AbortSignal.any([ticket.abort.signal, AbortSignal.timeout(80_000)]),
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ version: BRIEF_VERSION, jobId, resultFingerprint: fingerprint }) });
      const raw = await response.json();
      if (!response.ok) throw new Error(raw.error ?? "Explanation unavailable.");
      const accepted = briefSchema.parse(raw);
      if (accepted.resultFingerprint !== fingerprint || accepted.receipt.jobId !== jobId)
        throw new Error("Explanation refers to a different plan.");
      if (accepts()) setSaved({ identity, brief: accepted });
    } catch (reason) {
      if (accepts()) setError(reason instanceof Error ? reason.message : "Explanation unavailable.");
    } finally {
      if (gate.current.finish(ticket) && latestIdentity.current === identity) setBusy(false);
    }
  }
  return { brief, busy, error, reviewed: !!reviewedAt, reviewedAt, copied, explain,
    setReviewed: value => setReview(value && brief ? { identity, at: new Date().toISOString() } : null), setCopied, setError };
}
