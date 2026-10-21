import type { OperationsOverviewModel } from "../scenario-engine";
import type { WorkloadAssessment, WorkloadDecision } from "../workload-intelligence";

/** Display projections only. Candidate power is not a time-matched dispatch result. */
export function selectComputeSummary(
  assessment: WorkloadAssessment,
  model: OperationsOverviewModel,
) {
  const required = assessment.requiredWorkloadResponseMw;
  const nominal = assessment.recommendedPowerMw;
  return {
    total: assessment.decisions.length,
    eligible: assessment.eligibleJobs,
    candidates: assessment.recommendedJobs,
    required,
    nominal,
    scale: Math.max(1, Math.ceil(Math.max(required, nominal) * 1.15)),
    unrecovered:
      model.summaries.find((item) => item.kind === "battery_workload")?.unresolvedWorkMwh ?? null,
    status:
      required <= 0
        ? "No workload movement required"
        : !assessment.recommendedJobs
          ? "No eligible candidate selected"
          : nominal < required
            ? "Nominal candidate power is insufficient"
            : "Schedule validation required",
  };
}

export function workloadWindow(workload: WorkloadDecision, from: number, to: number) {
  const earliest = Date.parse(workload.earliestStart);
  const deadline = Date.parse(workload.deadline);
  const proposed = Date.parse(
    workload.recommended ? workload.proposedStart : workload.earliestStart,
  );
  const duration = workload.expectedDurationMinutes * 60_000;
  if (
    ![earliest, deadline, proposed, duration, from, to].every(Number.isFinite) ||
    deadline <= earliest ||
    duration <= 0 ||
    to <= from
  )
    return null;
  const clip = (start: number, end: number) => {
    if (end <= from || start >= to) return null;
    const left = Math.max(from, start),
      right = Math.min(to, end);
    return {
      left: ((left - from) / (to - from)) * 100,
      width: (Math.max(0, right - left) / (to - from)) * 100,
      before: start < from,
      after: end > to,
    };
  };
  return {
    declared: clip(earliest, earliest + duration),
    allowed: clip(earliest, deadline),
    proposed: workload.recommended ? clip(proposed, proposed + duration) : null,
    deadline: deadline >= from && deadline <= to ? ((deadline - from) / (to - from)) * 100 : null,
    missesDeadline: proposed + duration > deadline,
  };
}
