import type { FacilityPlanRequest } from "@/features/analytics/contracts";
import { prepareCanonicalFacilityPlan } from "@/features/operations/canonical-planning";
import type { OperationsAssessmentRequest } from "@/features/operations/operations-service";
import { operationsWorkspaceSchema } from "@/features/operations/workspace-contract";
import { supabase } from "@/integrations/supabase/client";
import {
assessmentEnvelopeSchema,
assuranceResultSchema,
operationsCapabilitiesSchema,
overviewResultSchema,
powerResultSchema,
workloadResultSchema,
} from "../features/operations/transport-contracts";
import { startFacilityPlan } from "./analytics-api";

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

export async function requestOperationsAssessment<T>(
  input: OperationsAssessmentRequest,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/operations/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });
  const body = (await response.json()) as OperationsAssessmentEnvelope<T> | { error: string };
  if (!response.ok || "error" in body)
    throw new Error("error" in body ? body.error : "The Operations assessment failed.");
  const validated = assessmentEnvelopeSchema.parse(body);
  if (input.kind === "overview") overviewResultSchema.parse(validated.result);
  if (input.kind === "compute") workloadResultSchema.parse(validated.result);
  if (input.kind === "power") powerResultSchema.parse(validated.result);
  if (input.kind === "assurance") assuranceResultSchema.parse(validated.result);
  return validated as OperationsAssessmentEnvelope<T>;
}

export async function fetchOperationsCapabilities(signal?: AbortSignal) {
  const response = await fetch("/api/operations/capabilities", {
    headers: { accept: "application/json" },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Operations connector status is unavailable.");
  return operationsCapabilitiesSchema.parse(await response.json());
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
