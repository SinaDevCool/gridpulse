import type { OperationsAssessmentRequest } from "@/features/operations/operations-service";
import { operationsWorkspaceSchema } from "@/features/operations/workspace-contract";
import { supabase } from "@/integrations/supabase/client";
import { prepareCanonicalFacilityPlan } from "@/features/operations/canonical-planning";
import { startFacilityPlan } from "./analytics-api";
import type { FacilityPlanRequest } from "@/features/analytics/contracts";

export type OperationsAssessmentEnvelope<T> = {
  schemaVersion: "gridpulse-operations-assessment-v1";
  calculationVersion: string;
  generatedAt: string;
  evidenceClass: "measured" | "reference" | "simulated";
  automaticDispatchAuthorized: false;
  quality: { sampleCount: number; completenessPercent: number; warnings: string[] };
  assessmentId: string;
  inputFingerprint: string;
  result: T;
};

export async function requestOperationsAssessment<T>(input: OperationsAssessmentRequest) {
  const response = await fetch("/api/operations/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json()) as OperationsAssessmentEnvelope<T> | { error: string };
  if (!response.ok || "error" in body)
    throw new Error("error" in body ? body.error : "The Operations assessment failed.");
  return body;
}

export async function fetchOperationsCapabilities() {
  const response = await fetch("/api/operations/capabilities", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Operations connector status is unavailable.");
  return response.json() as Promise<{
    schemaVersion: string;
    persistence: { configured: boolean; provider: string };
    connectors: Array<{
      id: string;
      label: string;
      status: string;
      transport: string;
      evidence: string[];
    }>;
  }>;
}

export async function fetchOperationsWorkspace(facilityId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication is required to load facility evidence.");
  const response = await fetch(
    `/api/operations/workspace?facilityId=${encodeURIComponent(facilityId)}`,
    {
      headers: { accept: "application/json", authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? "The Operations workspace could not be loaded.");
  return operationsWorkspaceSchema.parse(body);
}

export async function startCanonicalOperationsPlan(
  facilityId: string,
  approvedRequest?: FacilityPlanRequest,
) {
  const workspace = await fetchOperationsWorkspace(facilityId);
  const preparation = prepareCanonicalFacilityPlan(workspace, approvedRequest);
  if (!preparation.ready)
    throw new Error(`Canonical planning is blocked: ${preparation.blockers.join(" ")}`);
  return startFacilityPlan(preparation.request);
}
