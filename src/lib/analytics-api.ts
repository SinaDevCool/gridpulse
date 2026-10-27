import { accountingRequestSchema, type AccountingRequest } from "../features/analytics/experiment-contracts";
import { experimentRequestSchema, type ExperimentRequest } from "../features/analytics/experiment-contracts";
import {
  capacityRequirementRequestSchema,
  facilityHistoricalReplayRequestSchema,
  facilityPlanRequestSchema,
  facilityUncertaintyRequestSchema,
  fcaIntervalRequestSchema,
  fcaProfileRequestSchema,
  marketQualificationRequestSchema,
  operatorEnquiryPackageRequestSchema,
  rollingFacilityPlanRequestSchema,
  shadowVerificationRequestSchema,
  type CapacityRequirementRequest,
  type FacilityHistoricalReplayRequest,
  type FacilityPlanRequest,
  type FacilityUncertaintyRequest,
  type FcaIntervalRequest,
  type FcaProfileRequest,
  type MarketQualificationRequest,
  type OperatorEnquiryPackageRequest,
  type RollingFacilityPlanRequest,
  type ShadowVerificationRequest,
} from "../features/analytics/contracts";
import {
  analyticsJobSchema,
  jobAcceptedSchema,
  type AnalyticsJob,
  type JobAccepted,
} from "../features/analytics/job-contracts";
import { supabase } from "../integrations/supabase/client";
import { pollDelay } from "../features/analytics/poll-delay";
import { publicMilpClient, publicMilpEnabled } from "./public-milp-session";

export { type AnalyticsJob, type AnalyticsJobStatus } from "../features/analytics/job-contracts";

export type GraphGuidedStudyRequest = {
  network_model: Record<string, unknown>;
  scenarios: Array<Record<string, unknown>>;
  source_bus: string;
  target_buses: string[];
  mandatory_contingencies?: string[];
  solver_budget: number;
  validation_mode?: "qualification";
};

function analyticsBaseUrl(): string {
  const configured = import.meta.env.VITE_ANALYTICS_API_URL;
  if (!configured) throw new Error("VITE_ANALYTICS_API_URL is not configured");
  return configured.replace(/\/$/, "");
}

async function authenticatedRequest(path: string, init?: RequestInit): Promise<unknown> {
  const publicRequest = publicMilpEnabled() &&
    (path === "/v1/jobs/facility-plan" || /^\/v1\/jobs\/[a-f0-9-]{36}(\/cancel)?$/i.test(path));
  const {
    data: { session },
  } = await (publicRequest ? publicMilpClient() : supabase).auth.getSession();
  if (!session) throw new Error(publicRequest
    ? "No public visitor session. Start a MILP calculation to create a restricted session."
    : "Analytics jobs are unavailable in the public Finder");

  // A user-initiated submission may need to wake the free service. Polls and
  // other API calls retain their shorter timeout; no background keepalive.
  const timeoutMs = publicRequest && path === "/v1/jobs/facility-plan" ? 120_000 : 30_000;
  const response = await fetch(`${analyticsBaseUrl()}${path}`, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Analytics request failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function acceptedRequest(path: string, init?: RequestInit): Promise<JobAccepted> {
  return jobAcceptedSchema.parse(await authenticatedRequest(path, init));
}

export function startOperatorSourceHealthJob(): Promise<JobAccepted> {
  return acceptedRequest("/v1/jobs/operator-source-health", { method: "POST" });
}

export function startGraphGuidedStudy(input: GraphGuidedStudyRequest): Promise<JobAccepted> {
  return acceptedRequest("/v1/jobs/graph-guided-study", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startFacilityPlan(input: FacilityPlanRequest): Promise<JobAccepted> {
  const payload = facilityPlanRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/facility-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFcaInterval(
  input: FcaIntervalRequest,
  signal?: AbortSignal,
): Promise<JobAccepted> {
  const payload = fcaIntervalRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/fca-interval", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function startFcaProfile(input: FcaProfileRequest): Promise<JobAccepted> {
  const payload = fcaProfileRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/fca-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startCapacityRequirement(input: CapacityRequirementRequest): Promise<JobAccepted> {
  const payload = capacityRequirementRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/capacity-requirement", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFacilityUncertainty(input: FacilityUncertaintyRequest): Promise<JobAccepted> {
  const payload = facilityUncertaintyRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/facility-uncertainty", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFacilityHistoricalReplay(
  input: FacilityHistoricalReplayRequest,
): Promise<JobAccepted> {
  const payload = facilityHistoricalReplayRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/facility-historical-replay", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startMarketQualification(input: MarketQualificationRequest): Promise<JobAccepted> {
  const payload = marketQualificationRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/market-qualification", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startRollingFacilityPlan(input: RollingFacilityPlanRequest): Promise<JobAccepted> {
  const payload = rollingFacilityPlanRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/rolling-facility-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startOperatorEnquiryPackage(
  input: OperatorEnquiryPackageRequest,
): Promise<JobAccepted> {
  const payload = operatorEnquiryPackageRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/operator-enquiry-package", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startShadowVerification(input: ShadowVerificationRequest): Promise<JobAccepted> {
  const payload = shadowVerificationRequestSchema.parse(input);
  return acceptedRequest("/v1/jobs/shadow-verification", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function waitForAnalyticsJob(
  jobId: string,
  onUpdate?: (job: AnalyticsJob) => void,
  intervalMs = 1500,
  signal?: AbortSignal,
): Promise<AnalyticsJob> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    signal?.throwIfAborted();
    const job = await loadAnalyticsJob(jobId, signal);
    onUpdate?.(job);
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job;
    await pollDelay(intervalMs, signal);
  }
  throw new Error("Analytics job polling timed out");
}

export async function loadAnalyticsJob(jobId: string, signal?: AbortSignal): Promise<AnalyticsJob> {
  return analyticsJobSchema.parse(
    await authenticatedRequest(`/v1/jobs/${encodeURIComponent(jobId)}`, { signal }),
  );
}

export async function listAnalyticsJobs(limit = 100): Promise<AnalyticsJob[]> {
  return analyticsJobSchema
    .array()
    .parse(await authenticatedRequest(`/v1/jobs?limit=${Math.min(Math.max(limit, 1), 200)}`));
}

export async function cancelAnalyticsJob(jobId: string): Promise<AnalyticsJob> {
  return analyticsJobSchema.parse(
    await authenticatedRequest(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
    }),
  );
}

export function safeAnalyticsError(job: AnalyticsJob): string | null {
  if (job.status !== "failed") return null;
  return job.error
    ? "The study could not complete. Review quarantined cases or retry."
    : "The study could not complete.";
}


export function startFacilityExperiment(input: ExperimentRequest): Promise<JobAccepted> {
  return acceptedRequest("/v1/jobs/facility-experiment", {
    method: "POST", body: JSON.stringify(experimentRequestSchema.parse(input)),
  });
}

export function startFacilityAccounting(input: AccountingRequest): Promise<JobAccepted> {
  return acceptedRequest("/v1/jobs/facility-accounting", {
    method: "POST", body: JSON.stringify(accountingRequestSchema.parse(input)),
  });
}
