import type { WorkloadDecision } from "../workload-intelligence";

export type ReviewGroup = "all" | "candidate" | "eligible" | "protected";
export function matchesReviewGroup(job: WorkloadDecision, group: ReviewGroup) {
  return (
    group === "all" ||
    (group === "candidate"
      ? job.recommended
      : group === "eligible"
        ? job.eligible && !job.recommended
        : !job.eligible && !job.recommended)
  );
}
export function selectReviewGroups(jobs: WorkloadDecision[]) {
  return (
    [
      ["candidate", "Candidates for review"],
      ["eligible", "Other eligible workloads"],
      ["protected", "Protected workloads"],
    ] as const
  ).map(([id, label]) => ({
    id,
    label,
    count: jobs.filter((job) => matchesReviewGroup(job, id)).length,
  }));
}
