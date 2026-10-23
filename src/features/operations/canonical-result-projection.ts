import { z } from "zod";
import { facilityPlanResultSchema, type FacilityPlanRequest } from "../analytics/contracts";

const finite = z.number().finite();
const powerPoint = z.object({
  interval_index: z.number().int().nonnegative(),
  grid_import_mw: finite.nonnegative(),
  battery_charge_mw: finite.nonnegative(),
  battery_discharge_mw: finite.nonnegative(),
}).passthrough();
const trajectory = z.object({ points: z.array(powerPoint).min(1) }).passthrough();
const replayedResult = z.object({
  status: z.enum(["optimal", "feasible_not_proven_optimal"]),
  solver: z.literal("scipy-highs-milp"),
  solver_termination: z.enum(["optimal", "limit_reached"]),
  optimality_gap: finite.nonnegative().nullable(),
  model_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  automatic_live_dispatch_authorized: z.literal(false),
  assessment: z.object({ feasible: z.literal(true) }).passthrough(),
  diagnostics: z.array(z.unknown()).max(0),
  facility: trajectory,
  portfolio: z.object({
    workload_trajectories: z.array(z.object({
      workload_id: z.string().min(1),
      points: z.array(z.object({ interval_index: z.number().int().nonnegative() }).passthrough()),
    }).passthrough()),
  }).passthrough(),
  battery_trajectories: z.array(z.object({
    resource_id: z.string().min(1),
    points: z.array(z.object({ timestamp: z.string().datetime({ offset: true }), soc_mwh: finite.nonnegative() }).passthrough()),
  }).passthrough()),
  intervals: z.array(z.object({
    index: z.number().int().nonnegative(), start: z.string().datetime({ offset: true }),
    duration_minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  }).passthrough()).min(1),
  baseline_facility: trajectory,
}).passthrough();

/** Shared acceptance boundary for explicitly selected canonical MILP results.
 * Never mix canonical power, heuristic workload windows and unrelated BMS SOC.
 * expectedInputFingerprint is supplied by the authenticated request owner.
 */
export function projectCanonicalAssessment(
  raw: unknown,
  expectedInputFingerprint: string,
  expectedRequest?: FacilityPlanRequest,
  maximumIncumbentGap = 0.05,
) {
  const envelope = facilityPlanResultSchema.parse(raw);
  if (envelope.input_fingerprint !== expectedInputFingerprint)
    throw new Error("Canonical result belongs to a different assessment request");
  const result = replayedResult.parse(envelope.result);
  if (!Number.isFinite(maximumIncumbentGap) || maximumIncumbentGap < 0 || maximumIncumbentGap > 1)
    throw new Error("Invalid canonical incumbent acceptance policy");
  if (result.status === "optimal" ? result.solver_termination !== "optimal" :
      result.solver_termination !== "limit_reached" || result.optimality_gap === null || result.optimality_gap > maximumIncumbentGap)
    throw new Error("Canonical solver termination or incumbent gap is not accepted");
  const size = result.facility.points.length;
  if (result.intervals.length !== size || result.intervals.some((interval, index) =>
    interval.index !== index || (index > 0 && Date.parse(interval.start) !==
      Date.parse(result.intervals[index - 1].start) + result.intervals[index - 1].duration_minutes * 60_000)))
    throw new Error("Canonical timestamps do not define a contiguous planning horizon");
  const aligned = (points: { interval_index: number }[]) =>
    points.length === size && points.every((point, index) => point.interval_index === index);
  if (!aligned(result.facility.points) || !aligned(result.baseline_facility.points) ||
      result.portfolio.workload_trajectories.some((job) => !aligned(job.points)) ||
      result.battery_trajectories.some((battery) => battery.points.length !== size ||
        battery.points.some((point, index) => Date.parse(point.timestamp) !== Date.parse(result.intervals[index].start))))
    throw new Error("Canonical chart trajectories do not share one planning horizon");
  const jobs = result.portfolio.workload_trajectories;
  const batteries = result.battery_trajectories;
  if (new Set(jobs.map((job) => job.workload_id)).size !== jobs.length ||
      new Set(batteries.map((battery) => battery.resource_id)).size !== batteries.length)
    throw new Error("Canonical chart trajectories contain duplicate identities");
  if (expectedRequest) {
    const sameIds = (actual: string[], expected: unknown[]) =>
      expected.every((id) => typeof id === "string" && id.length > 0) &&
      new Set(expected).size === expected.length && actual.length === expected.length &&
      actual.every((id) => expected.includes(id));
    if (!sameIds(jobs.map((job) => job.workload_id), expectedRequest.workloads.map((job) => job.workload_id)) ||
        !sameIds(batteries.map((battery) => battery.resource_id), (expectedRequest.batteries ?? []).map((battery) => battery.resource_id)))
      throw new Error("Canonical result resources differ from the submitted request");
    if (expectedRequest.intervals.length !== size || expectedRequest.intervals.some((interval, index) =>
      interval.index !== result.intervals[index].index ||
      interval.duration_minutes !== result.intervals[index].duration_minutes ||
      typeof interval.start !== "string" || Date.parse(interval.start) !== Date.parse(result.intervals[index].start)))
      throw new Error("Canonical result horizon differs from the submitted request");
  }
  const identity = Object.freeze({
    method: "canonical_milp" as const,
    inputFingerprint: envelope.input_fingerprint,
    resultFingerprint: envelope.result_fingerprint,
    modelFingerprint: result.model_fingerprint,
    status: result.status,
    engineVersion: envelope.engine_version,
    truthClass: envelope.truth_class,
    optimalityGap: result.optimality_gap,
    solverTermination: result.solver_termination,
    physicalDispatchAuthorized: false as const,
  });
  return {
    identity,
    intervals: result.intervals,
    overview: { identity, power: result.facility.points, baseline: result.baseline_facility.points },
    compute: { identity, power: result.facility.points, workloads: jobs },
    power: { identity, power: result.facility.points, batteries },
  };
}
