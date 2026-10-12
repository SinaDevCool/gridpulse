export interface PrivateTopologySummary {
  pathwayCount: number;
  completePathwayCount: number;
  sharedUpstreamAssetCount: number;
  physicsStudyCompleted: boolean;
  validationClass: "synthetic_demonstration" | "operator_model_unvalidated" | "operator_model_reconciled" | "operator_reviewed";
}

export function topologyConclusions(summary: PrivateTopologySummary): string[] {
  const conclusions = [
    `${summary.pathwayCount} topology pathway${summary.pathwayCount === 1 ? "" : "s"} identified`,
    `${summary.completePathwayCount} with complete electrical parameters`,
    `${summary.sharedUpstreamAssetCount} shared upstream asset${summary.sharedUpstreamAssetCount === 1 ? "" : "s"}`,
    summary.physicsStudyCompleted ? "Physics study completed" : "Physics study pending",
  ];
  if (summary.validationClass === "synthetic_demonstration") {
    conclusions.unshift("Synthetic topology demonstration—not an operator model");
  }
  return conclusions;
}

export const topologySafetyNotice =
  "Topology pathways guide investigation. They do not establish available grid capacity.";
