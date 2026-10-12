import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
export function listSiteCandidates(site: CandidateSite) {
  return supabase
    .from("project_site_candidates")
    .select("*")
    .eq("site_id", site.id)
    .order("created_at", { ascending: true });
}

export function listOperatorPackages(site: CandidateSite) {
  return supabase
    .from("operator_packages")
    .select("*")
    .eq("site_id", site.id)
    .order("version", { ascending: false });
}

export function listPilotMetrics(site: CandidateSite) {
  return supabase
    .from("pilot_metrics")
    .select("*")
    .eq("site_id", site.id)
    .order("observed_at", { ascending: false });
}

export function readOperatorEngagement(site: CandidateSite) {
  return supabase
    .from("operator_engagements")
    .select("estimated_connection_cost_eur,indicated_connection_date")
    .eq("site_id", site.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}
