import { runCanonicalFcaInterval } from "@/features/analytics/fca-client";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-runIntervalSimulation";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<
  StrategyControllerContract,
  "site" | "scenarios" | "profiles" | "setIntervalResult" | "input"
>;
export async function execute(
  context: Context,
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
): Promise<void> {
  const { site, scenarios, profiles, setIntervalResult, input } = context;
  const profile = profiles[0];
  if (!profile) {
    toast.error("Upload a validated interval profile first.");
    return;
  }
  try {
    const analysis = await runCanonicalFcaInterval(
      profile.points,
      {
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
      },
      signal,
    );
    if (!isCurrent()) return;
    setIntervalResult(analysis);
    if (!isCurrent()) return;
    const { timeline, ...summary } = analysis;
    const { error } = await strategyQueries.saveSimulation(
      site,
      profile,
      scenarios,
      input,
      analysis,
      summary,
      timeline,
    );
    if (error) toast.error(error.message);
    else toast.success("Versioned interval simulation saved");
  } catch (error) {
    if (!isCurrent()) return;
    toast.error(error instanceof Error ? error.message : "Unable to simulate profile");
  }
  return;
}
