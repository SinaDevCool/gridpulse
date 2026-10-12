import type { CandidateSite, Evidence, OperatorPackage, Scenario } from "@/lib/assessment-model";
import { runCommand, type CommandOutcome } from "./application-contract";

export interface DecisionRepository {
  recordDecision(
    siteId: string,
    decision: Record<string, unknown>,
    actions: Array<{ title: string; due_at: string }>,
    activity: { scenario_name: string },
  ): Promise<{ id: string; version: number }>;
}
export async function recordDecision(
  repository: DecisionRepository,
  input: {
    site: CandidateSite;
    preferredScenario: Scenario | null | undefined;
    scenarios: Scenario[];
    evidence: Evidence[];
    packages: OperatorPackage[];
  },
  now: number = Date.now(),
): Promise<CommandOutcome<{ id: string; version: number }>> {
  if (!input.preferredScenario) return { ok: false, message: "Select a preferred strategy first." };
  const preferred = input.preferredScenario;
  const rationale = preferred.selection_rationale?.trim();
  if (!rationale)
    return { ok: false, message: "The preferred strategy needs a recorded rationale." };
  const titles = [
    "Confirm responsible network operator",
    "Complete operator evidence checklist",
    "Submit operator engagement package",
    "Log operator response and requested studies",
    "Negotiate the flexible connection envelope",
  ];
  return runCommand(() =>
    repository.recordDecision(
      input.site.id,
      {
        scenario_id: preferred.id,
        package_id: input.packages[0]?.id ?? null,
        rationale,
        alternatives_rejected: input.scenarios
          .filter((item) => item.id !== preferred.id)
          .map((item) => ({ id: item.id, name: item.name })),
        conditions_to_proceed: [
          "Written operator confirmation",
          "Technical study",
          "Commercial approval",
        ],
        assumptions: [
          "No available capacity is inferred",
          "All limits are declared or operator-supplied",
        ],
        evidence_ids: input.evidence.map((item) => item.id),
      },
      titles.map((title, index) => ({
        title,
        due_at: new Date(now + (index + 1) * 14 * 86_400_000).toISOString(),
      })),
      { scenario_name: preferred.name },
    ),
  );
}
