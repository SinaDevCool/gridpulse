import { runCanonicalFcaInterval } from "@/features/analytics/fca-client";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-runIntervalSimulation";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<
  ReturnType<typeof useStrategyController>,
  "site" | "scenarios" | "profiles" | "setIntervalResult" | "input"
>;
export async function execute(context: Context): Promise<unknown> {
  const { site, scenarios, profiles, setIntervalResult, input } = context;
  const profile = profiles[0];
  if (!profile) {
    toast.error("Upload a validated interval profile first.");
    return;
  }
  try {
    const analysis = await runCanonicalFcaInterval(profile.points, {
      firmImportMw: input.firmImportMw,
      conditionalImportMw: input.conditionalImportMw,
      minimumCriticalLoadMw: input.minimumCriticalLoadMw,
      shiftableLoadMw: input.shiftableLoadMw,
      batteryPowerMw: input.batteryPowerMw,
      batteryEnergyMwh: input.batteryEnergyMwh,
      batteryRoundTripEfficiency: input.batteryRoundTripEfficiency,
      batteryMinimumSoc: input.batteryMinimumSoc,
      initialBatterySoc: input.initialBatterySoc,
      energyValueEurMwh: input.energyValueEurMwh,
      batteryDegradationEurMwh: input.batteryDegradationEurMwh,
      minimumViableImportMw: site.minimum_viable_import_mw ?? input.minimumCriticalLoadMw,
    });
    setIntervalResult(analysis);
    const existing = await strategyQueries.selectFlexibilitySimulations1(site, profile);
    const { timeline, ...summary } = analysis;
    const { error } = await strategyQueries.insertFlexibilitySimulations2(
      site,
      profile,
      scenarios,
      existing,
      input,
      analysis,
      summary,
      timeline,
    );
    if (error) toast.error(error.message);
    else toast.success("Versioned interval simulation saved");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to simulate profile");
  }
  return;
}
