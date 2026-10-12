import { toast } from "sonner";
import * as strategyQueries from "./repository-command-saveFlexibility";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<
  ReturnType<typeof useStrategyController>,
  "site" | "profiles" | "refresh" | "setBusy" | "input" | "result" | "specificationValidation"
>;
export async function execute(context: Context): Promise<unknown> {
  const { site, profiles, refresh, setBusy, input, result, specificationValidation } = context;
  setBusy(true);
  const profileName = "Declared operating flexibility";
  const previous = await strategyQueries.selectFlexibilityProfiles1(site, profileName);
  if (previous.error) {
    setBusy(false);
    toast.error(previous.error.message);
    return;
  }
  const { error } = await strategyQueries.insertFlexibilityProfiles2(
    site,
    profileName,
    previous,
    input,
    specificationValidation,
    profiles,
    result,
  );
  setBusy(false);
  if (error) toast.error(`${error.message}. Apply the Phase 2 database migration first.`);
  else {
    toast.success("Flexibility analysis saved");
    await refresh();
  }
  return;
}
