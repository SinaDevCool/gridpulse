import type { FacilityPlanRequest } from "@/features/analytics/contracts";
import { prepareCanonicalFacilityPlan } from "@/features/operations/canonical-planning";
import type { PlanningTime } from "@/features/operations/planning-time";
import type { OperationsAssessmentRequest } from "@/features/operations/operations-service";
import type { OperationsOverviewModel } from "@/features/operations/scenario-engine";
import type { WorkloadAssessment } from "@/features/operations/workload-intelligence";
import type { z } from "zod";
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
import { operationsFingerprint } from "./operations-request";
import { operationsAssessmentRequestSchema } from "@/features/operations/assessment-request";

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

type AssessmentResults = {
  overview: OperationsOverviewModel;
  compute: WorkloadAssessment;
  power: z.infer<typeof powerResultSchema>;
  assurance: z.infer<typeof assuranceResultSchema>;
};

export function requestOperationsAssessment<K extends OperationsAssessmentRequest["kind"]>(
  input: Extract<OperationsAssessmentRequest, { kind: K }>,
  signal?: AbortSignal,
): Promise<OperationsAssessmentEnvelope<AssessmentResults[K]>>;
export async function requestOperationsAssessment(
  input: OperationsAssessmentRequest,
  signal?: AbortSignal,
) {
  input = operationsAssessmentRequestSchema.parse(input);
  const response = await fetch("/api/operations/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });
  const body: unknown = await response.json();
  if (!response.ok || (body !== null && typeof body === "object" && "error" in body))
    throw new Error(
      body !== null && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "The Operations assessment failed.",
    );
  const validated = assessmentEnvelopeSchema.parse(body);
  if (validated.inputFingerprint !== (await operationsFingerprint(input)))
    throw new Error("Operations assessment input identity does not match the current request.");
  if (input.kind === "overview") {
    const result = overviewResultSchema.parse(validated.result);
    if (input.evidence && !result.assessmentPlan)
      throw new Error(
        "The service does not support shared evidence assessments. Refresh after deployment.",
      );
  }
  if (input.kind === "compute") workloadResultSchema.parse(validated.result);
  if (input.kind === "power") powerResultSchema.parse(validated.result);
  if (input.kind === "assurance") assuranceResultSchema.parse(validated.result);
  return validated;
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
  planningTime?: PlanningTime,
) {
  const workspace = await fetchOperationsWorkspace(facilityId);
  const preparation = prepareCanonicalFacilityPlan(workspace, approvedRequest, planningTime);
  if (!preparation.ready)
    throw new Error(`Canonical planning is blocked: ${preparation.blockers.join(" ")}`);
  return startFacilityPlan(preparation.request);
}
