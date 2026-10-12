import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite,IntervalProfile,Scenario } from "@/lib/assessment-model";
import type { DispatchAnalysis } from "@/lib/fca-engine";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { FlexibleLoadSpecification } from "../flexible-load";
export function selectFlexibilitySimulations1(site: CandidateSite, profile: IntervalProfile) {
  return supabase
    .from("flexibility_simulations")
    .select("version")
    .eq("site_id", site.id)
    .eq("profile_id", profile.id)
    .order("version", { ascending: false })
    .limit(1);
}

export function insertFlexibilitySimulations2(
  site: CandidateSite,
  profile: IntervalProfile,
  scenarios: Scenario[],
  existing: PostgrestSingleResponse<{ version: number }[]>,
  input: FlexibleLoadSpecification,
  analysis: DispatchAnalysis,
  summary: {
    calculationVersion: "de-fca-interval-v3";
    intervalMinutes: number;
    intervalCount: number;
    peakBaselineImportMw: number;
    restrictedIntervals: number;
    restrictedHours: number;
    restrictionEvents: number;
    longestRestrictionHours: number;
    minimumViableBreaches: number;
    maximumShortfallMw: number;
    residualUnservedMwh: number;
    constrainedEnergyMwh: number;
    shiftedWorkloadMwh: number;
    batteryDischargeMwh: number;
    equivalentBatteryCycles: number;
    demandServedPercent: number;
    estimatedAnnualExposureEur: number;
    classification:
      | "operationally_feasible"
      | "feasible_with_constraints"
      | "fails_minimum_viable_capacity"
      | "operator_validation_required";
    warnings: string[];
  },
  timeline: import("@/lib/fca-engine").DispatchInterval[],
) {
  return supabase.from("flexibility_simulations").insert({
    site_id: site.id,
    profile_id: profile.id,
    scenario_id: scenarios.find((item) => item.selection_status === "preferred")?.id ?? null,
    version: (existing.data?.[0]?.version ?? 0) + 1,
    settings: input,
    summary,
    timeline,
    calculation_version: analysis.calculationVersion,
    classification: analysis.classification,
    input_manifest: {
      profileId: profile.id,
      profileVersion: profile.version,
      profileHash: profile.source_hash,
      sourceClassification: profile.source_classification,
      scenarioId: scenarios.find((item) => item.selection_status === "preferred")?.id ?? null,
    },
  });
}
