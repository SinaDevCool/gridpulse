import type { FacilityPlanRequest } from "../analytics/contracts";
import type { OperationsWorkspace } from "./workspace-contract";

export type CanonicalPlanPreparation =
  | { ready: true; request: FacilityPlanRequest; blockers: []; warnings: string[] }
  | { ready: false; request: null; blockers: string[]; warnings: string[] };

/**
 * Projects persisted Operations evidence into the canonical facility-plan contract.
 * It deliberately performs no feasibility or dispatch calculation.
 */
export function prepareCanonicalFacilityPlan(
  workspace: OperationsWorkspace,
): CanonicalPlanPreparation {
  const blockers = [...workspace.readiness.blockers];
  const warnings: string[] = [];
  const importPoints = workspace.measurements.filter(
    (point) => point.metricKey === "facility_grid_import_mw" && point.quality === "accepted",
  );
  if (workspace.facility.limitEvidence !== "operator_confirmed" &&
      workspace.facility.limitEvidence !== "contract_reviewed")
    blockers.push("The facility import limit is not contract-reviewed or operator-confirmed.");
  if (importPoints.length < 4)
    blockers.push("At least four accepted facility-import intervals are required.");
  if (!workspace.workloads.length)
    warnings.push("No evidenced workload portfolio is available; workload response is zero.");
  if (!workspace.batteryAssets.length)
    warnings.push("No battery asset configuration is available; battery response is zero.");
  const uniqueBlockers = [...new Set(blockers)];
  if (uniqueBlockers.length) return { ready: false, request: null, blockers: uniqueBlockers, warnings };

  const byTimestamp = new Map<string, Record<string, number>>();
  for (const point of workspace.measurements) {
    if (point.quality !== "accepted") continue;
    const values = byTimestamp.get(point.eventAt) ?? {};
    values[point.metricKey] = point.value;
    byTimestamp.set(point.eventAt, values);
  }
  const intervals = importPoints.map((point, index) => ({
    interval_id: `${workspace.facility.id}:${index}`,
    timestamp: point.eventAt,
    duration_minutes: intervalMinutes(importPoints, index),
    baseline_import_mw: point.value,
    facility_limit_mw: workspace.facility.contractedImportLimitMw,
    ...byTimestamp.get(point.eventAt),
  }));

  return {
    ready: true,
    blockers: [],
    warnings,
    request: {
      schema_version: "gridpulse-facility-plan-request-v1",
      portfolio_id: workspace.facility.id,
      requirement: {
        facility_id: workspace.facility.id,
        maximum_grid_import_mw: workspace.facility.contractedImportLimitMw,
        limit_evidence: workspace.facility.limitEvidence,
        evidence_cutoff: workspace.readiness.freshestEvidenceAt,
      },
      intervals,
      facility: {
        id: workspace.facility.id,
        name: workspace.facility.name,
        timezone: workspace.facility.timezone,
        batteries: workspace.batteryAssets,
      },
      workloads: workspace.workloads,
      profiles: [{ profile_id: "observed-facility-import", intervals }],
      policy: {
        mode: "shadow",
        automatic_live_dispatch_authorized: false,
        fail_closed: true,
      },
      economics: { enabled: false },
      cooling: { source: "operations_measurements", modeled_when_missing: false },
    },
  };
}
function intervalMinutes(
  points: OperationsWorkspace["measurements"],
  index: number,
) {
  const current = Date.parse(points[index].eventAt);
  const adjacent = points[index + 1] ?? points[index - 1];
  if (!adjacent) return 15;
  return Math.max(1, Math.round(Math.abs(Date.parse(adjacent.eventAt) - current) / 60_000));
}

