import type { CandidateSite } from "@/lib/assessment-model";
import type { FlexibleLoadSpecification } from "../flexible-load";
export function initialStrategyInput(
  site: Pick<CandidateSite, "requested_import_mw" | "bess_power_mw" | "bess_energy_mwh">,
): FlexibleLoadSpecification {
  return {
    requestedImportMw: site.requested_import_mw,
    firmImportMw: Math.max(0, site.requested_import_mw * 0.65),
    conditionalImportMw: Math.max(0, site.requested_import_mw * 0.15),
    minimumCriticalLoadMw: Math.max(0, site.requested_import_mw * 0.5),
    shiftableLoadMw: Math.max(0, site.requested_import_mw * 0.1),
    batteryPowerMw: site.bess_power_mw ?? 0,
    batteryEnergyMwh: site.bess_energy_mwh ?? 0,
    restrictionDurationHours: 2,
    restrictionEventsPerYear: 20,
    energyValueEurMwh: 200,
    batteryDegradationEurMwh: 20,
    maximumEventsPerDay: 2,
    recoveryHours: 4,
    geographicTransferMw: 0,
    notificationLeadMinutes: 30,
    rampDownMwPerMinute: 0,
    rampUpMwPerMinute: 0,
    upsPowerMw: 0,
    upsEnergyMwh: 0,
    generatorPowerMw: 0,
    generatorMaxHoursYear: 0,
    batteryRoundTripEfficiency: 0.9,
    batteryMinimumSoc: 0.1,
    initialBatterySoc: 1,
  };
}
