import { supabase } from "../integrations/supabase/client";
import {
  capacityRequirementRequestSchema,
  facilityPlanRequestSchema,
  fcaIntervalRequestSchema,
  fcaProfileRequestSchema,
  facilityUncertaintyRequestSchema,
  facilityHistoricalReplayRequestSchema,
  marketQualificationRequestSchema,
  rollingFacilityPlanRequestSchema,
  operatorEnquiryPackageRequestSchema,
  shadowVerificationRequestSchema,
  type CapacityRequirementRequest,
  type FacilityPlanRequest,
  type FcaIntervalRequest,
  type FcaProfileRequest,
  type FacilityUncertaintyRequest,
  type FacilityHistoricalReplayRequest,
  type MarketQualificationRequest,
  type RollingFacilityPlanRequest,
  type OperatorEnquiryPackageRequest,
  type ShadowVerificationRequest,
} from "../features/analytics/contracts";

export type AnalyticsJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AnalyticsJob {
  id: string;
  owner_id: string;
  job_type: string;
  status: AnalyticsJobStatus;
  input_payload: Record<string, unknown>;
  result_payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  checkpoint_payload: Record<string, unknown>;
  cancellation_requested: boolean;
}

interface JobAccepted {
  job_id: string;
  status: AnalyticsJobStatus;
}

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

async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Analytics jobs are unavailable in the public Finder");

  const response = await fetch(`${analyticsBaseUrl()}${path}`, {
    ...init,
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
  return (await response.json()) as T;
}

export function startOperatorSourceHealthJob(): Promise<JobAccepted> {
  return authenticatedRequest<JobAccepted>("/v1/jobs/operator-source-health", { method: "POST" });
}

export function startGraphGuidedStudy(input: GraphGuidedStudyRequest): Promise<JobAccepted> {
  return authenticatedRequest<JobAccepted>("/v1/jobs/graph-guided-study", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startFacilityPlan(input: FacilityPlanRequest): Promise<JobAccepted> {
  const payload = facilityPlanRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/facility-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFcaInterval(input: FcaIntervalRequest): Promise<JobAccepted> {
  const payload = fcaIntervalRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/fca-interval", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function startFcaProfile(input: FcaProfileRequest): Promise<JobAccepted> {
  const payload = fcaProfileRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/fca-interval", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function startCapacityRequirement(input: CapacityRequirementRequest): Promise<JobAccepted> {
  const payload = capacityRequirementRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/capacity-requirement", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFacilityUncertainty(input: FacilityUncertaintyRequest): Promise<JobAccepted> {
  const payload = facilityUncertaintyRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/facility-uncertainty", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startFacilityHistoricalReplay(input: FacilityHistoricalReplayRequest): Promise<JobAccepted> {
  const payload = facilityHistoricalReplayRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/facility-historical-replay", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startMarketQualification(input: MarketQualificationRequest): Promise<JobAccepted> {
  const payload = marketQualificationRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/market-qualification", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startRollingFacilityPlan(input: RollingFacilityPlanRequest): Promise<JobAccepted> {
  const payload = rollingFacilityPlanRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/rolling-facility-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startOperatorEnquiryPackage(input: OperatorEnquiryPackageRequest): Promise<JobAccepted> {
  const payload = operatorEnquiryPackageRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/operator-enquiry-package", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startShadowVerification(input: ShadowVerificationRequest): Promise<JobAccepted> {
  const payload = shadowVerificationRequestSchema.parse(input);
  return authenticatedRequest<JobAccepted>("/v1/jobs/shadow-verification", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function waitForAnalyticsJob(
  jobId: string,
  onUpdate?: (job: AnalyticsJob) => void,
  intervalMs = 1500,
): Promise<AnalyticsJob> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = await loadAnalyticsJob(jobId);
    onUpdate?.(job);
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Analytics job polling timed out");
}

export function loadAnalyticsJob(jobId: string): Promise<AnalyticsJob> {
  return authenticatedRequest<AnalyticsJob>(`/v1/jobs/${encodeURIComponent(jobId)}`);
}

export function listAnalyticsJobs(limit = 100): Promise<AnalyticsJob[]> {
  return authenticatedRequest<AnalyticsJob[]>(`/v1/jobs?limit=${Math.min(Math.max(limit, 1), 200)}`);
}

export function cancelAnalyticsJob(jobId: string): Promise<AnalyticsJob> {
  return authenticatedRequest<AnalyticsJob>(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
}

export function safeAnalyticsError(job: AnalyticsJob): string | null {
  if (job.status !== "failed") return null;
  return job.error ? "The study could not complete. Review quarantined cases or retry." :
    "The study could not complete.";
}
