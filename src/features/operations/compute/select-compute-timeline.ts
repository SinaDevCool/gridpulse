import type { OperationsInterval } from "../scenario-engine";
import type { WorkloadDecision } from "../workload-intelligence";

/** Presentation projection only. The assessment remains the calculation authority. */
export function selectComputeTimeline(points: OperationsInterval[], target: number) {
  return points.map((point, index) => {
    const time = Date.parse(point.timestamp);
    const next = points[index + 1];
    const inferred = next
      ? (Date.parse(next.timestamp) - time) / 60_000
      : index > 0
        ? (time - Date.parse(points[index - 1].timestamp)) / 60_000
        : 15;
    const duration =
      point.durationMinutes != null && point.durationMinutes > 0
        ? point.durationMinutes
        : Math.max(1, inferred);
    return {
      ...point,
      time,
      end: time + duration * 60_000,
      requiredWorkloadMw: Math.max(0, point.batteryDemandMw - target),
    };
  });
}

export function workloadTimeRelationship(job: WorkloadDecision | undefined, timestamp: string) {
  if (!job) return "Select a workload to inspect its timing";
  const time = Date.parse(timestamp),
    start = Date.parse(job.earliestStart);
  const deadline = Date.parse(job.deadline),
    duration = job.expectedDurationMinutes * 60_000;
  const proposed = Date.parse(job.proposedStart);
  if (
    ![time, start, deadline, duration, ...(job.recommended ? [proposed] : [])].every(
      Number.isFinite,
    ) ||
    duration <= 0 ||
    deadline <= start
  )
    return "Workload timing unavailable";
  if (job.recommended && time >= proposed && time < proposed + duration)
    return "Inside proposed reference window—not execution";
  if (time >= start && time < start + duration)
    return "Inside earliest-start reference window—not execution";
  if (time >= start && time < deadline) return "Inside permitted window; no execution implied";
  return "Outside permitted workload window";
}

export function candidateInterval(job: WorkloadDecision, points: OperationsInterval[]) {
  if (!points.length) return undefined;
  const start = Date.parse(job.recommended ? job.proposedStart : job.earliestStart);
  if (!Number.isFinite(start)) return undefined;
  return points.reduce((best, point) =>
    Math.abs(Date.parse(point.timestamp) - start) < Math.abs(Date.parse(best.timestamp) - start)
      ? point
      : best,
  ).timestamp;
}
