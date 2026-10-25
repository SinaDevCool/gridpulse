import type { CanonicalPresentation } from "./canonical-presentation";

export type ComputeFilter = "all" | "attention" | "flexible" | "protected";
const time = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

/** Presentation arithmetic over accepted results only. Never runs heuristic scheduling. */
export function selectCanonicalComputeView(a: CanonicalPresentation, timestamp: string) {
  const index = Math.max(0, a.points.findIndex(point => point.timestamp === timestamp));
  const start = Date.parse(a.points[0].timestamp);
  const end = Date.parse(a.points.at(-1)!.endTimestamp!);
  const jobs = a.jobs.map(job => {
    const declared = a.request.workloads.find(row => row.workload_id === job.id);
    const sla = declared?.sla as Record<string, unknown> | undefined;
    const protectedWork = declared?.workload_kind === "critical_inference" ? true :
      typeof declared?.workload_kind === "string" ? false : null;
    const earliest = time(declared?.earliest_start);
    const deadline = time(sla?.deadline);
    const remaining = job.endingRemainingWorkHours ?? job.points.at(-1)?.remaining_work_hours ?? null;
    const activity = job.points.filter(point => point.power_mw > 0 || point.checkpoint_or_restart);
    const first = activity[0]?.interval_index;
    const last = activity.at(-1)?.interval_index;
    return { ...job, name: typeof declared?.name === "string" ? declared.name : job.id,
      protectedWork, earliest, deadline, nominalPower: numeric(declared?.nominal_power_mw),
      minimumPower: numeric(declared?.minimum_power_cap_mw),
      expectedMinutes: numeric(declared?.expected_duration_minutes),
      minimumThroughput: numeric(sla?.minimum_throughput_fraction),
      minGpu: numeric(declared?.minimum_gpu_count), maxGpu: numeric(declared?.maximum_gpu_count),
      maxDelay: numeric(declared?.maximum_start_delay_minutes), remaining,
      complete: remaining === null ? null : remaining <= 1e-6,
      attention: remaining === null || remaining > 1e-6 || job.deadlineMet !== true ||
        protectedWork === null || deadline === null || earliest === null,
      current: job.points[index],
      first: first === undefined ? null : a.points[first].timestamp,
      last: last === undefined ? null : a.points[last].endTimestamp,
      // Preserve every interval and every gap, including zero-power checkpoint activity.
      segments: activity.map(point => ({ ...point, start: a.points[point.interval_index].timestamp,
        end: a.points[point.interval_index].endTimestamp! })),
    };
  });
  const points = a.points.map((point, i) => {
    const sum = (protection: boolean | null) => jobs.filter(job => job.protectedWork === protection)
      .reduce((total, job) => total + job.points[i].power_mw, 0);
    return { ...point, plotTime: Date.parse(point.timestamp), flexibleMw: sum(false),
      protectedMw: sum(true), unknownMw: sum(null) };
  });
  return { jobs, points, index, start, end,
    completed: jobs.filter(job => job.complete === true).length,
    deadlinesMet: jobs.filter(job => job.deadlineMet === true).length,
    deadlineUnavailable: jobs.filter(job => job.deadlineMet === undefined).length,
    remaining: jobs.some(job => job.remaining === null) ? null : jobs.reduce((sum, job) => sum + job.remaining!, 0),
    peak: points.reduce((best, point) => (point.workloadPowerMw ?? 0) > (best.workloadPowerMw ?? 0) ? point : best).timestamp,
  };
}
export type CanonicalComputeModel = ReturnType<typeof selectCanonicalComputeView>;
export type CanonicalComputeJob = CanonicalComputeModel["jobs"][number];
export function matchesCanonicalCompute(job: CanonicalComputeJob, filter: ComputeFilter) {
  return filter === "all" || (filter === "attention" ? job.attention :
    filter === "protected" ? job.protectedWork === true : job.protectedWork === false);
}
export const computeFilters: { id: ComputeFilter; label: string }[] = [
  { id: "all", label: "All workloads" }, { id: "attention", label: "Needs attention" },
  { id: "flexible", label: "Flexible workloads" }, { id: "protected", label: "Protected workloads" },
];
