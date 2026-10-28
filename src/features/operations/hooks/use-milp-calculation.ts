import type { GermanPlanning } from "../german-planning";
import { experimentRequestSchema, type ExperimentRequest, type ExperimentResult } from "../../analytics/experiment-contracts";
import { acceptExperimentResult, matchingExperimentJobs, submitCalculation } from "./experiment-lifecycle";
import { useEffect, useRef, useState } from "react";
import { startFacilityPlan, startFacilityExperiment, waitForAnalyticsJob, cancelAnalyticsJob, listAnalyticsJobs, type AnalyticsJob } from "@/lib/analytics-api";
import { ensureVisitorSession, publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";
import { stableOperationsJson } from "@/lib/operations-request";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { selectCanonicalPresentation, type CanonicalPresentation } from "../canonical-presentation";
import type { OperationsScenario } from "../scenario-engine";

export function useMilpCalculation() {
  const [result, setResult] = useState<{ assessment: CanonicalPresentation; scenarioIdentity: string; jobId?: string } | null>(null);
  const [experiment, setExperiment] = useState<ExperimentResult | null>(null);
  const [job, setJob] = useState<AnalyticsJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const snapshot = useRef<ReturnType<typeof buildSyntheticMilpRequest> | null>(null);
  const experimentSnapshot = useRef<ExperimentRequest | null>(null);
  const submittedId = useRef<string | null>(null);
  const identity = useRef("");
  useEffect(() => () => controller.current?.abort(), []);

  async function run(scenario: OperationsScenario, resumeId?: string, experimentRequest?: ExperimentRequest, planning?: GermanPlanning) {
    if (active.current) return;
    active.current = true; setBusy(true); setError(null);
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    try {
      if (resumeId && resumeId !== submittedId.current) throw new Error("Calculation identity changed. Resume the submitted job only.");
      if (!resumeId) {
        setResult(null); setJob(null); setExperiment(null); setJobId(null); submittedId.current = null;
        experimentSnapshot.current = experimentRequest ? structuredClone(experimentRequestSchema.parse(experimentRequest)) : null;
      }
      if (!resumeId && !experimentSnapshot.current) {
        snapshot.current = buildSyntheticMilpRequest(scenario, planning);
        if (planning?.enabled && publicMilpEnabled()) throw new Error("German market inputs require a separately qualified private runtime. Public synthetic planning remains unchanged.");
        identity.current = stableOperationsJson(planning?.enabled ? { scenario, planning } : scenario);
        if (publicMilpEnabled()) await ensureVisitorSession(publicMilpClient().auth);
      }
      const frozenExperiment = experimentSnapshot.current;
      const acceptedId = resumeId ?? await submitCalculation(snapshot.current, frozenExperiment,
        { plan: startFacilityPlan, experiment: startFacilityExperiment });
      submittedId.current = acceptedId;
      if (abort.signal.aborted) return;
      setJobId(acceptedId);
      const completed = await waitForAnalyticsJob(acceptedId, value => { if (!abort.signal.aborted) setJob(value); }, 2500, abort.signal);
      if (abort.signal.aborted) return;
      if (completed.id !== acceptedId) throw new Error("Calculation identity mismatch");
      setJob(completed);
      if (completed.status !== "succeeded") throw new Error(completed.error ?? `MILP job ${completed.status}; no result accepted.`);
      if (frozenExperiment) {
        const received = acceptExperimentResult(completed.result_payload, frozenExperiment);
        setExperiment(received);
        return;
      }
      setResult({ assessment: selectCanonicalPresentation(completed, snapshot.current!), scenarioIdentity: identity.current, jobId: acceptedId });
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "MILP calculation unavailable");
    } finally { active.current = false; if (!abort.signal.aborted) setBusy(false); }
  }
  async function recoverExperiment(scenario: OperationsScenario) {
    if (active.current || !experimentSnapshot.current || publicMilpEnabled()) return;
    active.current = true; setBusy(true); setError(null);
    const frozen = experimentSnapshot.current;
    const recovery = new AbortController(); controller.current = recovery;
    try {
      const jobs = matchingExperimentJobs(await listAnalyticsJobs(100), frozen);
      if (recovery.signal.aborted) return;
      if (jobs.length !== 1) throw new Error(jobs.length ? "Multiple matching jobs require service review; no calculation was submitted." : "No matching job is visible yet. No calculation was resubmitted.");
      submittedId.current = jobs[0].id;
      active.current = false;
      await run(scenario, jobs[0].id);
    } catch (reason) { if (!recovery.signal.aborted) setError(reason instanceof Error ? reason.message : "Job history unavailable"); }
    finally { active.current = false; if (!recovery.signal.aborted) setBusy(false); }
  }
  return { experiment, result, setResult, job, jobId, error, busy, run, recoverExperiment,
    cancel: async () => { if (jobId) { try { await cancelAnalyticsJob(jobId); } catch (reason) { setError(String(reason)); } } },
  };
}
