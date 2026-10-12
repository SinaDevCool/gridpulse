import type { Scenario } from "@/lib/assessment-model";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-duplicateScenario";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<StrategyControllerContract, "site" | "refresh" | "setBusy">;
export async function execute(context: Context, scenario: Scenario): Promise<void> {
  const { site, refresh, setBusy } = context;
  setBusy(true);
  try {
    const { error } = await strategyQueries.saveConnectionScenarios(site, scenario);
    if (error) toast.error(error.message);
    else {
      toast.success("Strategy duplicated as a new draft");
      await refresh();
    }
    return;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The command failed.");
  } finally {
    setBusy(false);
  }
}
