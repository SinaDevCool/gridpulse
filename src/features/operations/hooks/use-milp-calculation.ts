import { useEffect, useRef, useState } from "react";
import { startFacilityPlan, waitForAnalyticsJob, cancelAnalyticsJob, type AnalyticsJob } from "@/lib/analytics-api";
import { ensureVisitorSession, publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";
import { stableOperationsJson } from "@/lib/operations-request";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { selectCanonicalPresentation, type CanonicalPresentation } from "../canonical-presentation";
import type { OperationsScenario } from "../scenario-engine";

export function useMilpCalculation() {
  const [result, setResult] = useState<{ assessment: CanonicalPresentation; scenarioIdentity: string; jobId?: string } | null>(null);
  const [job, setJob] = useState<AnalyticsJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const snapshot = useRef<ReturnType<typeof buildSyntheticMilpRequest> | null>(null);
  const identity = useRef("");
  useEffect(() => () => controller.current?.abort(), []);

  async function run(scenario: OperationsScenario, resumeId?: string) {
    if (active.current) return;
    active.current = true; setBusy(true); setError(null);
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    try {
      if (!resumeId) {
        snapshot.current = buildSyntheticMilpRequest(scenario);
        identity.current = stableOperationsJson(scenario);
        setResult(null); setJob(null);
        if (publicMilpEnabled()) await ensureVisitorSession(publicMilpClient().auth);
      }
      if (!snapshot.current) throw new Error("The submitted input snapshot is unavailable. Start a new calculation.");
      const acceptedId = resumeId ?? (await startFacilityPlan(snapshot.current)).job_id;
      setJobId(acceptedId);
      const completed = await waitForAnalyticsJob(acceptedId, setJob, 2500, abort.signal);
      setJob(completed);
      if (completed.status !== "succeeded") throw new Error(completed.error ?? `MILP job ${completed.status}; no result accepted.`);
      setResult({ assessment: selectCanonicalPresentation(completed, snapshot.current), scenarioIdentity: identity.current, jobId: acceptedId });
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "MILP calculation unavailable");
    } finally { active.current = false; if (!abort.signal.aborted) setBusy(false); }
  }
  return { result, setResult, job, jobId, error, busy, run,
    cancel: async () => { if (jobId) { try { await cancelAnalyticsJob(jobId); } catch (reason) { setError(String(reason)); } } },
  };
}
