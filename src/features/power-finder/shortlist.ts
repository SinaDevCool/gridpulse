import type { PowerFinderFeature } from "@/features/power-finder/fixture-data";
import { supabase } from "@/integrations/supabase/client";

export async function savePowerFinderCandidate(feature: PowerFinderFeature): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in before saving a candidate.");

  const score =
    feature.properties.kind === "node"
      ? {
          evidence_class: feature.properties.evidence_class,
          capacity_state: feature.properties.capacity_state ?? "not_established",
        }
      : {};
  const { error } = await supabase.from("power_finder_shortlists").insert({
    user_id: user.id,
    source_feature_id: feature.id,
    feature_kind: feature.properties.kind,
    title: feature.properties.name,
    status: "screening",
    assumptions: {
      saved_from: "power_finder",
      capacity_not_inferred: true,
    },
    decision_snapshot: {
      feature,
      score,
      saved_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}
