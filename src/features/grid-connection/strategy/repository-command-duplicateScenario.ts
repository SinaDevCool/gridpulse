import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite, Scenario } from "@/lib/assessment-model";
export function saveConnectionScenarios(site: CandidateSite, scenario: Scenario) {
  return supabase.from("connection_scenarios").insert({
    site_id: site.id,
    user_id: site.user_id,
    name: `${scenario.name} copy`,
    connection_mode: scenario.connection_mode,
    scenario_type: scenario.scenario_type,
    max_import_mw: scenario.max_import_mw,
    conditional_import_mw: scenario.conditional_import_mw,
    eventual_import_mw: scenario.eventual_import_mw,
    max_export_mw: scenario.max_export_mw,
    minimum_critical_load_mw: scenario.minimum_critical_load_mw,
    firmness: scenario.firmness,
    outcome: scenario.outcome,
    assumptions: scenario.assumptions as never,
    enabling_assets: scenario.enabling_assets as never,
    dependencies: scenario.dependencies as never,
    unresolved_evidence: scenario.unresolved_evidence as never,
    provenance: scenario.provenance as never,
    evidence_readiness: scenario.evidence_readiness,
    energy_value_eur_mwh: scenario.energy_value_eur_mwh,
    calculation_version: scenario.calculation_version,
    restriction_schedule: scenario.restriction_schedule as never,
    status: "draft",
    selection_status: "candidate",
    supersedes_id: scenario.id,
  });
}
