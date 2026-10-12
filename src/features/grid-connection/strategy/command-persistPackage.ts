import { toast } from "sonner";
import * as strategyQueries from "./repository-command-persistPackage";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<
  StrategyControllerContract,
  | "site"
  | "evidence"
  | "scenarios"
  | "profiles"
  | "setBusy"
  | "refetchStrategyRecords"
  | "packages"
  | "result"
  | "packageGate"
  | "snapshot"
>;
export async function execute(
  context: Context,
  status: "draft" | "internal_review" | "approved" | "issued",
): Promise<void> {
  const {
    site,
    evidence,
    scenarios,
    profiles,
    setBusy,
    refetchStrategyRecords,
    packages,
    result,
    packageGate,
    snapshot,
  } = context;
  if ((status === "approved" || status === "issued") && !packageGate.ready) {
    toast.error("Resolve the package blockers before approval or issue.");
    return;
  }
  setBusy(true);
  try {
    const { data, error } = await strategyQueries.saveOperatorPackage(
      site,
      snapshot,
      evidence,
      scenarios,
      result,
      profiles,
      status,
    );
    if (error) toast.error(error.message);
    else {
      toast.success(`Package v${data.version} saved as ${status.replaceAll("_", " ")}`);
      await refetchStrategyRecords();
    }
    return;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The command failed.");
  } finally {
    setBusy(false);
  }
}
