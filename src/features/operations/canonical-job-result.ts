import { facilityPlanRequestSchema, type FacilityPlanRequest } from "../analytics/contracts";
import { analyticsJobSchema } from "../analytics/job-contracts";
import { stableOperationsJson } from "../../lib/operations-request";
import { projectCanonicalAssessment } from "./canonical-result-projection";

/** Mirror transport defaults only; physical defaults belong to the canonical engine. */
function requestIdentity(raw: FacilityPlanRequest) {
  const value = facilityPlanRequestSchema.parse(raw);
  return stableOperationsJson(Object.fromEntries(Object.entries({
    ...value, batteries: value.batteries ?? [], idle_gpu_power_watts: value.idle_gpu_power_watts ?? 0,
  }).filter(([, item]) => item !== null && item !== undefined)));
}

/** The existing authenticated job owns publication. This is not another job store. */
export function acceptCanonicalJobResult(raw: unknown, submitted: FacilityPlanRequest) {
  const job = analyticsJobSchema.parse(raw);
  if (job.job_type !== "facility_plan" || job.status !== "succeeded" || job.cancellation_requested || !job.input_fingerprint || !job.result_payload)
    throw new Error("Canonical job has no accepted facility-plan result");
  const actual = facilityPlanRequestSchema.parse(job.input_payload);
  if (requestIdentity(actual) !== requestIdentity(submitted))
    throw new Error("Canonical job inputs differ from the submitted snapshot");
  return projectCanonicalAssessment(job.result_payload, job.input_fingerprint, submitted);
}
