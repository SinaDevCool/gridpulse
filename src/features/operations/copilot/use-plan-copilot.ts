import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";
import { briefSchema, type PlanBrief } from "./brief";

export type PlanCopilotState = {
  brief: PlanBrief | null; busy: boolean; error: string | null; reviewed: boolean; copied: boolean;
  explain: () => Promise<void>; setReviewed: (value: boolean) => void;
  setCopied: (value: boolean) => void; setError: (value: string | null) => void;
};

export function usePlanCopilot({ jobId, fingerprint, current }: {
  jobId?: string; fingerprint: string; current: boolean;
}): PlanCopilotState {
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
  return { brief, busy, error, reviewed, copied, explain, setReviewed, setCopied, setError };
}

