import { facilityPlanRequestSchema, type FacilityPlanRequest } from "../analytics/contracts";
import type { OperationsWorkspace } from "./workspace-contract";

export type CanonicalPlanPreparation =
  | { ready: true; request: FacilityPlanRequest; blockers: []; warnings: string[] }
  | { ready: false; request: null; blockers: string[]; warnings: string[] };

/** No duplicate optimiser: electrical/thermal models and power profiles must
 * be supplied explicitly. A meter series cannot define those parameters. */
export function prepareCanonicalFacilityPlan(
  workspace: OperationsWorkspace,
  approvedRequest?: FacilityPlanRequest,
): CanonicalPlanPreparation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const imports = workspace.measurements
    .filter(
      (point) => point.metricKey === "facility_grid_import_mw" && point.quality === "accepted",
    )
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt));
  if (!["operator_confirmed", "contract_reviewed"].includes(workspace.facility.limitEvidence))
    blockers.push("The facility import limit is not contract-reviewed or operator-confirmed.");
  if (
    workspace.facility.limitValidUntil &&
    Date.parse(workspace.facility.limitValidUntil) <= Date.now()
  )
    blockers.push("The facility import-limit evidence has expired.");
  if (imports.length < 4)
    blockers.push("At least four accepted facility-import intervals are required.");
  if (new Set(imports.map((point) => point.eventAt)).size !== imports.length)
    blockers.push("Duplicate facility-import intervals require reconciliation.");
  const cutoff = Date.parse(workspace.evidenceWindow?.end ?? workspace.generatedAt);
  if (
    imports.some(
      (point) =>
        Date.parse(point.eventAt) > cutoff ||
        (point.receivedAt && Date.parse(point.receivedAt) > cutoff),
    )
  )
    blockers.push("Facility-import evidence includes data after the planning cutoff.");
  const durations = imports
    .slice(1)
    .map((point, index) => Date.parse(point.eventAt) - Date.parse(imports[index].eventAt));
  if (durations.some((duration) => duration <= 0 || duration !== durations[0]))
    blockers.push(
      "Facility-import intervals are irregular or contain gaps; reconcile them before planning.",
    );
  if (
    imports.some((point) => point.unit !== "MW" || point.value < 0 || !Number.isFinite(point.value))
  )
    blockers.push("Facility-import values or units are invalid.");
  if (workspace.readiness.mode !== "historical" && workspace.readiness.blockers.length)
    blockers.push(...workspace.readiness.blockers);
  if (
    !workspace.sources.some(
      (source) => source.type === "facility_meter" && source.health === "healthy",
    )
  )
    blockers.push("No healthy facility-meter source is connected.");
  if (!workspace.workloads.length)
    warnings.push(
      "No evidenced workload portfolio is available; workload scheduling cannot be validated.",
    );
  if (!workspace.batteryAssets.length)
    warnings.push("No battery asset configuration is available; battery response is zero.");
  if (!approvedRequest)
    blockers.push(
      "Supply a reviewed canonical facility model, workload power profiles, policy, cooling model and tariff contract. Meter readings alone cannot define these inputs.",
    );
  const parsed = approvedRequest ? facilityPlanRequestSchema.safeParse(approvedRequest) : null;
  if (parsed && !parsed.success)
    blockers.push("The reviewed canonical request has an invalid transport contract.");
  if (parsed?.success) {
    const request = parsed.data;
    if (request.facility.facility_id !== workspace.facility.id)
      blockers.push("The canonical model belongs to a different facility.");
    if (request.facility.import_limit_mw !== workspace.facility.contractedImportLimitMw)
      blockers.push("The canonical import limit differs from the accepted facility agreement.");
    if (!request.facility.truth_class || !request.requirement.truth_class)
      blockers.push("Canonical facility and requirement truth classes are required.");
    if (
      request.intervals.some(
        (point) => !Number.isInteger(point.index) || typeof point.start !== "string",
      )
    )
      blockers.push("Canonical intervals require indexes and start timestamps.");
    if (request.profiles.some((profile) => !profile.workload_id || !Array.isArray(profile.points)))
      blockers.push("Canonical workload profiles require explicit power/throughput points.");
    if (
      !Array.isArray(request.policy.event_intervals) ||
      !Array.isArray(request.economics.import_price_eur_per_mwh)
    )
      blockers.push("Canonical event policy and interval prices are required.");
  }
  if (blockers.length || !parsed?.success)
    return { ready: false, request: null, blockers: [...new Set(blockers)], warnings };
  return { ready: true, request: parsed.data, blockers: [], warnings };
}
