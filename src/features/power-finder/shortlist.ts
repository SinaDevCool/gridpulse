import type { PowerFinderFeature } from "@/features/power-finder/fixture-data";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateOpportunity } from "./candidate-intelligence";
import { scoreFeature } from "./screening-score";

export async function savePowerFinderCandidate(
  feature: PowerFinderFeature,
  opportunity?: CandidateOpportunity | null,
  requiredImportMw?: number,
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in before saving a candidate.");

  const score = scoreFeature(feature);
  const { data, error } = await supabase
    .from("power_finder_shortlists")
    .upsert(
      {
        user_id: user.id,
        source_feature_id: feature.id,
        feature_kind: feature.properties.kind,
        title: feature.properties.name,
        status: "screening",
        assumptions: {
          saved_from: "power_finder",
          capacity_not_inferred: true,
          required_import_mw: requiredImportMw ?? null,
        },
        decision_snapshot: {
          feature,
          opportunity: opportunity
            ? { ...opportunity, requiredImportMw: requiredImportMw ?? null }
            : null,
          score: score
            ? {
                score: score.total,
                label: score.label,
                evidence_class: feature.properties.evidence_class,
                capacity_state: feature.properties.capacity_state ?? "not_established",
              }
            : null,
          saved_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,source_feature_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
