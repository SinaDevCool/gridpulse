import type { WorkloadAssessment, WorkloadDecision } from "../workload-intelligence";
import { type ComputeWorkload } from "../workload-intelligence";
export function selectWorkloadQueue(
  assessment: WorkloadAssessment,
  status: "all" | ComputeWorkload["status"],
  selectedId: string | null,
  queuePage: number,
) {
  const decisions =
    status === "all"
      ? assessment.decisions
      : assessment.decisions.filter((workload) => workload.status === status);
  const selected =
    assessment.decisions.find((workload) => workload.workloadId === selectedId) ?? null;
  return { decisions, selected, ...paginateWorkloadDecisions(decisions, queuePage) };
}
export function paginateWorkloadDecisions(decisions: WorkloadDecision[], queuePage: number) {
  const orderedDecisions = [...decisions].sort(
    (a, b) => Number(b.recommended) - Number(a.recommended),
  );
  const pageCount = Math.max(1, Math.ceil(orderedDecisions.length / 50));
  const visiblePage = Math.min(queuePage, pageCount - 1);
  const visibleDecisions = orderedDecisions.slice(visiblePage * 50, (visiblePage + 1) * 50);
  return { orderedDecisions, pageCount, visiblePage, visibleDecisions };
}
