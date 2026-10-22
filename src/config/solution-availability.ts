export type SolutionId = "planning" | "operations";

/** Pure parser shared with build configuration: bad deployment flags fail before bundling. */
export function parseEnabledSolutions(value: string | undefined): readonly SolutionId[] {
  if (value === undefined || value === "all") return ["planning", "operations"];
  const ids = value.split(",").map((id) => id.trim());
  if (!ids.length || ids.some((id) => id !== "planning" && id !== "operations"))
    throw new Error(
      "GRIDPULSE_SOLUTIONS must be all, planning, operations or planning,operations.",
    );
  return [...new Set(ids)] as SolutionId[];
}
