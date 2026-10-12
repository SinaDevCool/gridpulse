import { recordedVersionReply } from "./record-contracts";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite, IntervalProfile } from "@/lib/assessment-model";
import type { FlexibleLoadSpecification, FlexibleLoadValidation } from "../flexible-load";
import { FLEXIBLE_LOAD_SPECIFICATION_VERSION } from "../flexible-load";
export async function appendFlexibilityProfile(
  site: CandidateSite,
  profileName: "Declared operating flexibility",
  input: FlexibleLoadSpecification,
  specificationValidation: FlexibleLoadValidation,
  profiles: IntervalProfile[],
  result: import("../domain").FlexibilityResult,
) {
  return recordedVersionReply(
    await supabase.rpc("gridpulse_append_flexibility", {
      p_site_id: site.id,
      p_profile: {
        site_id: site.id,
        name: profileName,
        requested_import_mw: input.requestedImportMw,
        firm_import_mw: input.firmImportMw,
        conditional_import_mw: input.conditionalImportMw,
        minimum_critical_load_mw: input.minimumCriticalLoadMw,
        shiftable_load_mw: input.shiftableLoadMw,
        battery_power_mw: input.batteryPowerMw,
        battery_energy_mwh: input.batteryEnergyMwh,
        restriction_duration_hours: input.restrictionDurationHours,
        restriction_events_per_year: input.restrictionEventsPerYear,
        maximum_curtailment_mw: specificationValidation.derived.maximumCurtailmentMw,
        maximum_event_duration_hours: input.restrictionDurationHours,
        maximum_events_per_day: input.maximumEventsPerDay,
        recovery_hours: input.recoveryHours,
        geographic_transfer_mw: input.geographicTransferMw,
        notification_lead_minutes: input.notificationLeadMinutes,
        ramp_down_mw_per_min: input.rampDownMwPerMinute,
        ramp_up_mw_per_min: input.rampUpMwPerMinute,
        ups_power_mw: input.upsPowerMw,
        ups_energy_mwh: input.upsEnergyMwh,
        generator_power_mw: input.generatorPowerMw,
        generator_max_hours_year: input.generatorMaxHoursYear,
        battery_round_trip_efficiency: input.batteryRoundTripEfficiency,
        battery_minimum_soc: input.batteryMinimumSoc,
        initial_battery_soc: input.initialBatterySoc,
        profile_id: profiles[0]?.id ?? null,
        validation_report: specificationValidation,
        specification_version: FLEXIBLE_LOAD_SPECIFICATION_VERSION,
        commercial_assumptions: {
          energyValueEurMwh: input.energyValueEurMwh,
          batteryDegradationEurMwh: input.batteryDegradationEurMwh,
        },
        result,
        status: "calculated",
      },
    }),
  );
}
