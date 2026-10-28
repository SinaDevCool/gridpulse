import { useEffect, useRef, useState } from "react";
import { requestCopilot } from "./copilot-client";
import { BRIEF_VERSION, briefSchema, briefReviewIdentity, type PlanBrief } from "./brief";
import { createBriefRequestLifecycle } from "./request-lifecycle";

export type PlanCopilotState = {
  brief: PlanBrief | null; busy: boolean; error: string | null; reviewed: boolean; reviewedAt: string | null; copied: boolean;
  explain: () => Promise<void>; setReviewed: (value: boolean) => void;
  setCopied: (value: boolean) => void; setError: (value: string | null) => void;
};
export function usePlanCopilot({ jobId, fingerprint, current, experimentJobId }: {
  jobId?: string; fingerprint: string; current: boolean; experimentJobId?: string;
}): PlanCopilotState {
  const [saved, setSaved] = useState<{ identity: string; brief: PlanBrief } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ identity: string; content:string; at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const gate = useRef(createBriefRequestLifecycle());
  const identity = `${jobId}:${fingerprint}:${current}:${experimentJobId ?? ""}`;
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const brief = saved?.identity === identity && current ? saved.brief : null;
  const reviewedAt = review?.identity === identity && brief && review.content===briefReviewIdentity(brief) ? review.at : null;
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
      const raw = await requestCopilot("brief", { version: BRIEF_VERSION, jobId, resultFingerprint: fingerprint, experimentJobId },
        AbortSignal.any([ticket.abort.signal, AbortSignal.timeout(80_000)]));
      const accepted = briefSchema.parse(raw);
      if (accepted.resultFingerprint !== fingerprint || accepted.receipt.jobId !== jobId)
        throw new Error("Explanation refers to a different plan.");
      if (accepted.investigation?.jobId !== experimentJobId) throw new Error("Investigation identity changed.");
      if (accepts()) setSaved({ identity, brief: accepted });
    } catch (reason) {
      if (accepts()) setError(reason instanceof Error ? reason.message : "Explanation unavailable.");
    } finally {
      if (gate.current.finish(ticket) && latestIdentity.current === identity) setBusy(false);
    }
  }
  return { brief, busy, error, reviewed: !!reviewedAt, reviewedAt, copied, explain,
    setReviewed: value => setReview(value && brief ? { identity, content:briefReviewIdentity(brief), at: new Date().toISOString() } : null), setCopied, setError };
}
