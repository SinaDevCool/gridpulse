import { toast } from "sonner";
import { decisionRepository } from "./repository-command-saveDecision";
import { recordDecision } from "./record-decision";
import type { StrategyControllerContract } from "./controller-contract";

type Context = Pick<
  StrategyControllerContract,
  "site" | "evidence" | "scenarios" | "refresh" | "setBusy" | "packages" | "preferredScenario"
>;
/** UI adapter; application command and repository remain independent of React. */
export async function execute(context: Context): Promise<void> {
  context.setBusy(true);
  try {
    const outcome = await recordDecision(decisionRepository, context);
    if (!outcome.ok) toast.error(outcome.message);
    else {
      toast.success("Decision saved and execution actions created");
      await context.refresh();
    }
  } finally {
    context.setBusy(false);
  }
}
