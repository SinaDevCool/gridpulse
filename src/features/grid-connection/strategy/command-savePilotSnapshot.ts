import { toast } from "sonner";
import * as strategyQueries from "./repository-command-savePilotSnapshot";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<
  StrategyControllerContract,
  | "site"
  | "evidence"
  | "setBusy"
  | "refetchStrategyRecords"
  | "candidates"
  | "result"
  | "decisionMatrix"
>;
export async function execute(context: Context): Promise<void> {
  const { site, evidence, setBusy, refetchStrategyRecords, candidates, result, decisionMatrix } =
    context;
  setBusy(true);
  try {
    const values = [
      [
        "evidence_completion",
        Math.round(
          (evidence.filter((item) => item.validation_status === "validated").length /
            Math.max(1, evidence.length)) *
            100,
        ),
        "percent",
      ],
      ["candidate_sites_compared", Math.max(1, candidates.length + 1), "sites"],
      ["connection_options_evaluated", decisionMatrix.length, "options"],
      [
        "operator_questions_open",
        decisionMatrix.reduce((sum, row) => sum + row.unresolvedGates, 0),
        "gates",
      ],
      ["modelled_annual_exposure", result.estimatedAnnualExposureEur, "EUR/year"],
    ] as const;
    const observedAt = new Date().toISOString();
    const { error } = await strategyQueries.insertPilotMetrics(values, site, observedAt);
    if (error) toast.error(error.message);
    else {
      toast.success("Pilot outcome snapshot saved");
      await refetchStrategyRecords();
    }
    return;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The command failed.");
  } finally {
    setBusy(false);
  }
}
