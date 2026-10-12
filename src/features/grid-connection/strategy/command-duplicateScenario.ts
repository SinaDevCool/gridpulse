import type { Scenario } from "@/lib/assessment-model";
import { toast } from "sonner";
import * as strategyQueries from "./repository-command-duplicateScenario";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<ReturnType<typeof useStrategyController>, "site" | "refresh" | "setBusy">;
export async function execute(context: Context, scenario: Scenario): Promise<unknown> {
  const { site, refresh, setBusy } = context;
  setBusy(true);
  const { error } = await strategyQueries.insertConnectionScenarios1(site, scenario);
  setBusy(false);
  if (error) toast.error(error.message);
  else {
    toast.success("Strategy duplicated as a new draft");
    await refresh();
  }
  return;
}
