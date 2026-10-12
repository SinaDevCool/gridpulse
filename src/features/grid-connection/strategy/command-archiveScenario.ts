import type { Scenario } from "@/lib/assessment-model";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-archiveScenario";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<StrategyControllerContract, "refresh" | "setBusy">;
export async function execute(context: Context, scenario: Scenario): Promise<void> {
  const { refresh, setBusy } = context;
  if (scenario.selection_status === "preferred") {
    toast.error("Select another preferred strategy before archiving this one.");
    return;
  }
  setBusy(true);
  try {
    const { error } = await strategyQueries.updateScenario(scenario);
    if (error) toast.error(error.message);
    else {
      toast.success("Strategy archived");
      await refresh();
    }
    return;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The command failed.");
  } finally {
    setBusy(false);
  }
}
