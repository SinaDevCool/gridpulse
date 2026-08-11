import { supabase } from "../integrations/supabase/client";

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

export function loadAnalyticsJob(jobId: string): Promise<AnalyticsJob> {
  return authenticatedRequest<AnalyticsJob>(`/v1/jobs/${encodeURIComponent(jobId)}`);
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
