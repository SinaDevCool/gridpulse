import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
export function updateConnectionScenarios1(site: CandidateSite) {
  return supabase
    .from("connection_scenarios")
    .update({ selection_status: "candidate" })
    .eq("site_id", site.id)
    .eq("selection_status", "preferred");
}

export function updateConnectionScenarios2(rationale: string, scenarioId: string) {
  return supabase
    .from("connection_scenarios")
    .update({ selection_status: "preferred", selection_rationale: rationale.trim() })
    .eq("id", scenarioId);
}
