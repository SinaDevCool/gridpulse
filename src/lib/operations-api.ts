import type { OperationsAssessmentRequest } from "@/features/operations/operations-service";

export type OperationsAssessmentEnvelope<T> = {
  schemaVersion: "gridpulse-operations-assessment-v1";
  calculationVersion: string;
  generatedAt: string;
  evidenceClass: "measured" | "reference" | "simulated";
  automaticDispatchAuthorized: false;
  quality: { sampleCount: number; completenessPercent: number; warnings: string[] };
  result: T;
};

export async function requestOperationsAssessment<T>(input: OperationsAssessmentRequest) {
  const response = await fetch("/api/operations/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as OperationsAssessmentEnvelope<T> | { error: string };
  if (!response.ok || "error" in body)
    throw new Error("error" in body ? body.error : "The Operations assessment failed.");
  return body;
}

export async function fetchOperationsCapabilities() {
  const response = await fetch("/api/operations/capabilities", {
    headers: { accept: "application/json" },
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
