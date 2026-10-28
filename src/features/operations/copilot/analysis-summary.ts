import {
  chronologicalShadowResultSchema,
  uncertaintyAnalysisResultSchema,
} from "../../analytics/investigation-contracts";
/** Summaries use returned flags and case statuses, never infer measured delivery. */
export function analysisSummary(raw: unknown) {
  const shadow = chronologicalShadowResultSchema.safeParse(raw);
  if (shadow.success)
    return {
      method: "Chronological model state handoff",
      accepted: shadow.data.revisions.every((r) => r.accepted),
      cases: shadow.data.revisions.map((r) => ({
        id: r.cutoff,
        status: r.accepted ? "Passed model checks" : "Failed model checks",
      })),
    };
  const value = uncertaintyAnalysisResultSchema.parse(raw).result;
  return {
    method:
      value.evaluation_method === "common_command_scenario_milp"
        ? "Shared commands over supplied cases"
        : "Independent scenario benchmark",
    accepted: value.accepted,
    cases: value.outcomes.map((row) => ({
      id: String(row.scenario_id),
      status:
        typeof row.status === "string"
          ? row.status
          : typeof row.result === "object" &&
              row.result !== null &&
              "status" in row.result
            ? String(row.result.status)
            : "See returned case checks",
    })),
  };
}
