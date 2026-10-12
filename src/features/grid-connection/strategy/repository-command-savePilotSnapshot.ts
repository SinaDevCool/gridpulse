import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
export function insertPilotMetrics1(
  values: readonly [
    readonly ["evidence_completion", number, "percent"],
    readonly ["candidate_sites_compared", number, "sites"],
    readonly ["connection_options_evaluated", number, "options"],
    readonly ["operator_questions_open", number, "gates"],
    readonly ["modelled_annual_exposure", number, "EUR/year"],
  ],
  site: CandidateSite,
  observedAt: string,
) {
  return supabase.from("pilot_metrics").insert(
    values.map(([metric_key, metric_value, unit]) => ({
      site_id: site.id,
      metric_key,
      metric_value,
      unit,
      source: "calculated_snapshot",
      observed_at: observedAt,
      notes: "Phase 4 decision-workspace snapshot; operator validation remains controlling.",
    })),
  );
}
