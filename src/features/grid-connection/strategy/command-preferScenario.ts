import { toast } from "sonner";
import * as strategyQueries from "./repository-command-preferScenario";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<ReturnType<typeof useStrategyController>, "site" | "refresh" | "setBusy">;
export async function execute(context: Context, scenarioId: string): Promise<unknown> {
  const { site, refresh, setBusy } = context;
  const rationale = window.prompt("Why is this the preferred connection strategy?");
  if (!rationale?.trim()) return;
  setBusy(true);
  const clear = await strategyQueries.updateConnectionScenarios1(site);
  const select = clear.error
    ? clear
    : await strategyQueries.updateConnectionScenarios2(rationale, scenarioId);
  setBusy(false);
  if (select.error) toast.error(select.error.message);
  else {
    toast.success("Preferred strategy recorded");
    await refresh();
  }
  return;
}
