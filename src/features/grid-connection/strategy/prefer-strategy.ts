import type { CommandOutcome } from "./application-contract";
import { runCommand } from "./application-contract";

export interface PreferredStrategyRepository {
  selectPreferred(siteId: string, scenarioId: string, rationale: string): Promise<void>;
}
/** Application command has no UI, browser prompt, React state or notifications. */
export async function preferStrategy(
  repository: PreferredStrategyRepository,
  input: { siteId: string; scenarioId: string; rationale: string },
): Promise<CommandOutcome<void>> {
  const rationale = input.rationale.trim();
  if (!rationale)
    return { ok: false, message: "The preferred strategy needs a recorded rationale." };
  return runCommand(() => repository.selectPreferred(input.siteId, input.scenarioId, rationale));
}
