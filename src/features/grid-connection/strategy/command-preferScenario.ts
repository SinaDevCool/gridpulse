import { toast } from "sonner";
import { preferredStrategyRepository } from "./repository-command-preferScenario";
import { preferStrategy } from "./prefer-strategy";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<StrategyControllerContract, "site" | "refresh" | "setBusy">;
export async function execute(context: Context, scenarioId: string): Promise<void> {
  const { site, refresh, setBusy } = context;
  const rationale = window.prompt("Why is this the preferred connection strategy?");
  if (!rationale?.trim()) return;
  setBusy(true);
  try {
    const outcome = await preferStrategy(preferredStrategyRepository, {
      siteId: site.id,
      scenarioId,
      rationale,
    });
    if (!outcome.ok) toast.error(outcome.message);
    else {
      toast.success("Preferred strategy recorded");
      await refresh();
    }
  } finally {
    setBusy(false);
  }
  return;
}
