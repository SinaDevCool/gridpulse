import { toast } from "sonner";
import * as strategyQueries from "./repository-command-saveFlexibility";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<
  StrategyControllerContract,
  "site" | "profiles" | "refresh" | "setBusy" | "input" | "result" | "specificationValidation"
>;
export async function execute(context: Context): Promise<void> {
  const { site, profiles, refresh, setBusy, input, result, specificationValidation } = context;
  setBusy(true);
  try {
    const profileName = "Declared operating flexibility";
    const { error } = await strategyQueries.appendFlexibilityProfile(
      site,
      profileName,
      input,
      specificationValidation,
      profiles,
      result,
    );
    if (error) toast.error(`${error.message}. Apply the Phase 2 database migration first.`);
    else {
      toast.success("Flexibility analysis saved");
      await refresh();
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to save flexibility");
  } finally {
    setBusy(false);
  }
  return;
}
