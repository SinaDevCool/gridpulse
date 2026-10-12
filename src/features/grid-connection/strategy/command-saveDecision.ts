import { toast } from "sonner";
import * as strategyQueries from "./repository-command-saveDecision";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<
  ReturnType<typeof useStrategyController>,
  "site" | "evidence" | "scenarios" | "refresh" | "setBusy" | "packages" | "preferredScenario"
>;
export async function execute(context: Context): Promise<unknown> {
  const { site, evidence, scenarios, refresh, setBusy, packages, preferredScenario } = context;
  if (!preferredScenario) {
    toast.error("Select a preferred strategy first.");
    return;
  }
  const rationale = preferredScenario.selection_rationale?.trim();
  if (!rationale) {
    toast.error("The preferred strategy needs a recorded rationale.");
    return;
  }
  setBusy(true);
  const versions = await strategyQueries.selectConnectionDecisions1(site);
  const decisionVersion = (versions.data?.[0]?.version ?? 0) + 1;
  const { data: decision, error } = await strategyQueries.insertConnectionDecisions2(
    site,
    preferredScenario,
    packages,
    decisionVersion,
    scenarios,
    evidence,
    rationale,
  );
  setBusy(false);
  if (error) toast.error(error.message);
  else {
    const actionTitles = [
      "Confirm responsible network operator",
      "Complete operator evidence checklist",
      "Submit operator engagement package",
      "Log operator response and requested studies",
      "Negotiate the flexible connection envelope",
    ];
    const now = Date.now();
    await strategyQueries.insertAssessmentMilestones3(
      actionTitles,
      site,
      now,
      decisionVersion,
      decision,
    );
    await strategyQueries.insertAssessmentActivity4(
      site,
      decision,
      decisionVersion,
      preferredScenario,
      packages,
    );
    toast.success("Decision saved and execution actions created");
    await refresh();
  }
  return;
}
