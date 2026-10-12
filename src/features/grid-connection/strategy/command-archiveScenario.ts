import type { Scenario } from "@/lib/assessment-model";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-archiveScenario";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<ReturnType<typeof useStrategyController>, "refresh" | "setBusy">;
export async function execute(context: Context, scenario: Scenario): Promise<unknown> {
  const { refresh, setBusy } = context;
  if (scenario.selection_status === "preferred") {
    toast.error("Select another preferred strategy before archiving this one.");
    return;
  }
  setBusy(true);
  const { error } = await strategyQueries.updateConnectionScenarios1(scenario);
  setBusy(false);
  if (error) toast.error(error.message);
  else {
    toast.success("Strategy archived");
    await refresh();
  }
  return;
}
