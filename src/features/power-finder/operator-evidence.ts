import { supabase } from "@/integrations/supabase/client";

export type OperatorEvidenceItem = {
  scope: "node_match" | "operator";
  title: string;
  url: string;
  evidence_type?: string;
  evidence_status?: string;
  source_kind?: string;
  demand_relevance?: "direct" | "context_only" | "none";
  access_mode?: string;
  legal_boundary?: string;
  caveats?: string[];
  confidence?: number;
  rationale?: string;
  project_status?: string;
  expected_service_date?: string;
};

export type OperatorEvidenceResult = {
  feature_id: string;
  node_name?: string;
  match_state: "accepted_node_evidence" | "operator_context_only" | "no_operator_evidence";
  items: OperatorEvidenceItem[];
};

function parseOperatorEvidence(value: unknown): OperatorEvidenceResult {
  if (!value || typeof value !== "object") throw new Error("Operator evidence is missing.");
  const candidate = value as Partial<OperatorEvidenceResult>;
  if (
    typeof candidate.feature_id !== "string" ||
    !Array.isArray(candidate.items) ||
    !["accepted_node_evidence", "operator_context_only", "no_operator_evidence"].includes(
      candidate.match_state ?? "",
    )
  ) {
    throw new Error("Operator evidence returned an invalid response.");
  }
  return candidate as OperatorEvidenceResult;
}

export async function loadOperatorEvidence(
  featureId: string,
  signal?: AbortSignal,
): Promise<OperatorEvidenceResult> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const { data, error } = await supabase.rpc("power_finder_operator_evidence", {
    feature_id: featureId,
  });
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (error) throw error;
  return parseOperatorEvidence(data);
}
