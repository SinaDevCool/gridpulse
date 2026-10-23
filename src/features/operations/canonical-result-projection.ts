import { z } from "zod";
import { facilityPlanResultSchema } from "../analytics/contracts";

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
    points: z.array(z.object({ soc_mwh: finite.nonnegative() }).passthrough()),
  }).passthrough()),
}).passthrough();

/** Staged integration boundary, deliberately not selected by the live store.
 * Never mix canonical power, heuristic workload windows and unrelated BMS SOC.
 * expectedInputFingerprint is supplied by the authenticated request owner.
 */
export function projectCanonicalAssessment(raw: unknown, expectedInputFingerprint: string) {
  const envelope = facilityPlanResultSchema.parse(raw);
  if (envelope.input_fingerprint !== expectedInputFingerprint)
    throw new Error("Canonical result belongs to a different assessment request");
  const result = replayedResult.parse(envelope.result);
  const size = result.facility.points.length;
  const aligned = (points: { interval_index: number }[]) =>
    points.length === size && points.every((point, index) => point.interval_index === index);
  if (!aligned(result.facility.points) ||
      result.portfolio.workload_trajectories.some((job) => !aligned(job.points)) ||
      result.battery_trajectories.some((battery) => battery.points.length !== size))
    throw new Error("Canonical chart trajectories do not share one planning horizon");
  const jobs = result.portfolio.workload_trajectories;
  const batteries = result.battery_trajectories;
  if (new Set(jobs.map((job) => job.workload_id)).size !== jobs.length ||
      new Set(batteries.map((battery) => battery.resource_id)).size !== batteries.length)
    throw new Error("Canonical chart trajectories contain duplicate identities");
  const identity = Object.freeze({
    method: "canonical_milp" as const,
    inputFingerprint: envelope.input_fingerprint,
    resultFingerprint: envelope.result_fingerprint,
    modelFingerprint: result.model_fingerprint,
    status: result.status,
    physicalDispatchAuthorized: false as const,
  });
  return {
    identity,
    overview: { identity, power: result.facility.points },
    compute: { identity, power: result.facility.points, workloads: jobs },
    power: { identity, power: result.facility.points, batteries },
  };
}
