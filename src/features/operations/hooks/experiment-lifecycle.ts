import { experimentResultSchema, type ExperimentRequest } from "../../analytics/experiment-contracts";
import type { FacilityPlanRequest } from "../../analytics/contracts";
import type { AnalyticsJob } from "../../analytics/job-contracts";
import { stableOperationsJson } from "../../../lib/operations-request";

/** Job history is owner-scoped by the API; match the frozen request before resuming. */
export function matchingExperimentJobs(jobs: AnalyticsJob[], request: ExperimentRequest) {
  return jobs.filter(job => {
    const baseline = job.input_payload.baseline as { result_fingerprint?: string } | undefined;
    return job.job_type === "facility_historical_replay" &&
      job.input_payload.schema_version === request.schema_version &&
      baseline?.result_fingerprint === request.baseline_result_fingerprint &&
      stableOperationsJson(job.input_payload.cases) === stableOperationsJson(request.cases);
  });
}

/** Exact experiments reconstruct their input from the owned baseline on the server. */
export async function submitCalculation(plan: FacilityPlanRequest | null, experiment: ExperimentRequest | null,
  submit: { plan: (value: FacilityPlanRequest) => Promise<{ job_id: string }>;
    experiment: (value: ExperimentRequest) => Promise<{ job_id: string }> }) {
  if (experiment) return (await submit.experiment(experiment)).job_id;
  if (!plan) throw new Error("The submitted input snapshot is unavailable. Start a new calculation.");
  return (await submit.plan(plan)).job_id;
}

export function acceptExperimentResult(raw: unknown, request: ExperimentRequest) {
  const result = experimentResultSchema.parse(raw);
  if (result.baseline_result_fingerprint !== request.baseline_result_fingerprint ||
    result.cases.length !== request.cases.length || result.cases.some((item, index) =>
      item.case_id !== request.cases[index].case_id || item.mode !== request.cases[index].mode))
    throw new Error("Experiment baseline or case identity mismatch");
  return result;
}
