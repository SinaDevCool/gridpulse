import { toast } from "sonner";
import * as strategyQueries from "./repository-command-persistPackage";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<
  ReturnType<typeof useStrategyController>,
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
): Promise<unknown> {
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
  const version = (packages[0]?.version ?? 0) + 1;
  const { error } = await strategyQueries.insertOperatorPackages1(
    site,
    snapshot,
    evidence,
    scenarios,
    result,
    profiles,
    status,
    version,
  );
  setBusy(false);
  if (error) toast.error(error.message);
  else {
    toast.success(`Package v${version} saved as ${status.replaceAll("_", " ")}`);
    await refetchStrategyRecords();
  }
  return;
}
