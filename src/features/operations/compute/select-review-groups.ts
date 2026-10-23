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

/** Highlighting is presentation only: never changes eligibility or the assessment. */
export function selectWorkloadWindows(
  decisions: WorkloadDecision[],
  group: ReviewGroup,
  showAll: boolean,
  requestedPage: number,
  selectedId: string | null,
) {
  const pool = decisions.filter((job) => job.recommended || showAll || group !== "all");
  const ordered = [...pool].sort(
    (a, b) => Number(matchesReviewGroup(b, group)) - Number(matchesReviewGroup(a, group)),
  );
  const pages = Math.max(1, Math.ceil(pool.length / 50));
  const page = Math.max(0, Math.min(requestedPage, pages - 1));
  const jobs = ordered.slice(page * 50, (page + 1) * 50);
  const inspected = decisions.find((job) => job.workloadId === selectedId);
  if (inspected && !jobs.some((job) => job.workloadId === selectedId)) jobs.push(inspected);
  return {
    jobs,
    inspected,
    page,
    pages,
    count: pool.length,
    highlighted: group === "all" ? 0 : pool.filter((job) => matchesReviewGroup(job, group)).length,
  };
}
