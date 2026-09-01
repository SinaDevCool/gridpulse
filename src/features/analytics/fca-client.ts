import { fcaIntervalResultSchema } from "./contracts";
import { startFcaInterval, startFcaProfile, waitForAnalyticsJob } from "@/lib/analytics-api";
import type { DispatchAnalysis, DispatchSettings, FcaAnalysis, IntervalPoint, RestrictionWindow } from "@/lib/fca-engine";

export async function runCanonicalFcaInterval(points: IntervalPoint[], settings: DispatchSettings): Promise<DispatchAnalysis> {
  const accepted = await startFcaInterval({
    schema_version: "gridpulse-fca-interval-request-v1",
    analysis_kind: "dispatch",
    points: points.map((point) => ({
      timestamp: point.timestamp, import_mw: point.importMw, export_mw: point.exportMw,
      ...(point.flexibleLoadMw == null ? {} : { flexible_load_mw: point.flexibleLoadMw }),
      ...(point.onsiteGenerationMw == null ? {} : { onsite_generation_mw: point.onsiteGenerationMw }),
      ...(point.connectionLimitMw == null ? {} : { connection_limit_mw: point.connectionLimitMw }),
      ...(point.connectionLimitFactor == null ? {} : { connection_limit_factor: point.connectionLimitFactor }),
    })),
    settings: {
      firm_import_mw: settings.firmImportMw, conditional_import_mw: settings.conditionalImportMw,
      minimum_critical_load_mw: settings.minimumCriticalLoadMw, shiftable_load_mw: settings.shiftableLoadMw,
      battery_power_mw: settings.batteryPowerMw, battery_energy_mwh: settings.batteryEnergyMwh,
      battery_round_trip_efficiency: settings.batteryRoundTripEfficiency,
      battery_minimum_soc: settings.batteryMinimumSoc, initial_battery_soc: settings.initialBatterySoc,
      energy_value_eur_mwh: settings.energyValueEurMwh,
      battery_degradation_eur_mwh: settings.batteryDegradationEurMwh,
      ...(settings.minimumViableImportMw == null ? {} : { minimum_viable_import_mw: settings.minimumViableImportMw }),
    },
  });
  const job = await waitForAnalyticsJob(accepted.job_id);
  if (job.status !== "succeeded" || !job.result_payload) throw new Error("Canonical FCA analysis failed");
  const envelope = fcaIntervalResultSchema.parse(job.result_payload);
  const value = envelope.result as Record<string, unknown>;
  const timeline = (value.timeline as Array<Record<string, unknown>>).map((point) => ({
    timestamp: String(point.timestamp), baselineImportMw: Number(point.baseline_import_mw),
    connectionLimitMw: Number(point.connection_limit_mw), workloadResponseMw: Number(point.workload_response_mw),
    batteryResponseMw: Number(point.battery_response_mw), batteryChargeMw: Number(point.battery_charge_mw),
    residualShortfallMw: Number(point.residual_shortfall_mw), batterySocMwh: Number(point.battery_soc_mwh),
  }));
  return {
    calculationVersion: "de-fca-interval-v3", intervalMinutes: Number(value.interval_minutes),
    intervalCount: Number(value.interval_count), peakBaselineImportMw: Number(value.peak_baseline_import_mw),
    restrictedIntervals: Number(value.restricted_intervals), restrictedHours: Number(value.restricted_hours),
    restrictionEvents: Number(value.restriction_events), longestRestrictionHours: Number(value.longest_restriction_hours),
    minimumViableBreaches: Number(value.minimum_viable_breaches), maximumShortfallMw: Number(value.maximum_shortfall_mw),
    residualUnservedMwh: Number(value.residual_unserved_mwh), constrainedEnergyMwh: Number(value.constrained_energy_mwh),
    shiftedWorkloadMwh: Number(value.shifted_workload_mwh), batteryDischargeMwh: Number(value.battery_discharge_mwh),
    equivalentBatteryCycles: Number(value.equivalent_battery_cycles), demandServedPercent: Number(value.demand_served_percent),
    estimatedAnnualExposureEur: Number(value.estimated_exposure_eur), classification: value.classification as DispatchAnalysis["classification"],
    timeline, warnings: value.warnings as string[],
  };
}

export async function runCanonicalFcaProfile(
  points: IntervalPoint[], mode: string, maxImportMw: number | null, maxExportMw: number | null,
  window: RestrictionWindow | null, energyValueEurMwh: number,
): Promise<FcaAnalysis> {
  const accepted = await startFcaProfile({
    schema_version: "gridpulse-fca-interval-request-v1", analysis_kind: "envelope_profile",
    points: points.map((point) => ({ timestamp: point.timestamp, import_mw: point.importMw, export_mw: point.exportMw })),
    settings: {
      mode, max_import_mw: maxImportMw, max_export_mw: maxExportMw,
      energy_value_eur_mwh: energyValueEurMwh,
      restriction_window: window ? { start_hour: window.startHour, end_hour: window.endHour, weekdays: window.weekdays } : null,
    },
  });
  const job = await waitForAnalyticsJob(accepted.job_id);
  if (job.status !== "succeeded" || !job.result_payload) throw new Error("Canonical FCA profile analysis failed");
  const value = fcaIntervalResultSchema.parse(job.result_payload).result as Record<string, unknown>;
  return {
    intervalCount: Number(value.interval_count), intervalMinutes: Number(value.interval_minutes),
    coveredHours: Number(value.covered_hours), restrictedIntervals: Number(value.restricted_intervals),
    restrictedHours: Number(value.restricted_hours), requestedImportMwh: Number(value.requested_import_mwh),
    requestedExportMwh: Number(value.requested_export_mwh), servedImportMwh: Number(value.served_import_mwh),
    servedExportMwh: Number(value.served_export_mwh), constrainedImportMwh: Number(value.constrained_import_mwh),
    constrainedExportMwh: Number(value.constrained_export_mwh), estimatedGrossImpactEur: Number(value.estimated_gross_impact_eur),
    calculationVersion: "fca-profile-v1",
  };
}
