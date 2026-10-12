import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
import type { OperatorScreening } from "@/lib/german-grid-screening";
import { number } from "./presentation";
export function insertProjectSiteCandidates1(
  site: CandidateSite,
  form: FormData,
  screenedOperator: OperatorScreening,
  maturity: {
    score: number;
    checks: { key: string; ready: boolean; weight: number }[];
    blockers: string[];
  },
  latitude: number,
  longitude: number,
) {
  return supabase.from("project_site_candidates").insert({
    site_id: site.id,
    name: String(form.get("name") || "Alternative site"),
    latitude,
    longitude,
    municipality: String(form.get("municipality") || "") || null,
    federal_state: String(form.get("federalState") || "") || null,
    target_voltage_kv: number(form, "targetVoltageKv") || null,
    likely_tso: screenedOperator.transmissionOperator,
    maturity_score: maturity.score,
    screening_status: "public_context_only",
    infrastructure_context: {
      regionalContext: screenedOperator.regionalContext,
      maturityChecks: maturity.checks,
      maturityBlockers: maturity.blockers,
      limitation: "No available-capacity conclusion. Confirm with the responsible operator.",
    },
  });
}
