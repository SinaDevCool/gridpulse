import { recordedVersionReply } from "./record-contracts";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite, IntervalProfile, Scenario } from "@/lib/assessment-model";
import type { DispatchAnalysis } from "@/lib/fca-engine";
import type { FlexibleLoadSpecification } from "../flexible-load";
export async function saveSimulation(
  site: CandidateSite,
  profile: IntervalProfile,
  scenarios: Scenario[],
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
  return recordedVersionReply(
    await supabase.rpc("gridpulse_append_strategy_simulation", {
      p_site_id: site.id,
      p_simulation: {
        site_id: site.id,
        profile_id: profile.id,
        scenario_id: scenarios.find((item) => item.selection_status === "preferred")?.id ?? null,
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
      },
    }),
  );
}
