import { describe, expect, it } from "vitest";
import { operationsWorkspaceSchema } from "./workspace-contract";
import { prepareCanonicalFacilityPlan } from "./canonical-planning";

function workspace() {
  return operationsWorkspaceSchema.parse({
    schemaVersion: "gridpulse-operations-workspace-v1",
    generatedAt: "2026-10-06T09:00:00.000Z",
    automaticDispatchAuthorized: false,
    facility: {
      id: "11111111-1111-4111-8111-111111111111", name: "Berlin AI Campus",
      timezone: "Europe/Berlin", contractedImportLimitMw: 100,
      limitEvidence: "operator_confirmed", limitValidUntil: null,
    },
    sources: [{
      id: "22222222-2222-4222-8222-222222222222", type: "facility_meter",
      name: "Main meter", health: "healthy", readOnly: true,
      lastReceivedAt: "2026-10-06T08:45:00.000Z", latestEventAt: "2026-10-06T08:45:00.000Z",
      consecutiveFailures: 0, lastErrorCode: null,
    }],
    measurements: [0, 15, 30, 45].map((minute) => ({
      metricKey: "facility_grid_import_mw", assetId: "facility",
      eventAt: `2026-10-06T08:${String(minute).padStart(2, "0")}:00.000Z`,
      value: 90 + minute / 15, unit: "MW", valueKind: "observed", quality: "accepted",
      sourceId: "22222222-2222-4222-8222-222222222222",
    })),
    batteryAssets: [{ id: "battery" }], workloads: [{ id: "workload" }],
    latestForecast: null, latestRecommendation: null, latestVerification: null, dataQuality: null,
    readiness: { mode: "historical", blockers: [], freshestEvidenceAt: "2026-10-06T08:45:00.000Z" },
  });
}

describe("canonical Operations plan preparation", () => {
  it("projects accepted evidence without calculating feasibility", () => {
    const result = prepareCanonicalFacilityPlan(workspace());
    expect(result.ready).toBe(true);
    if (!result.ready) return;
    expect(result.request.policy).toMatchObject({ mode: "shadow", automatic_live_dispatch_authorized: false });
    expect(result.request.intervals).toHaveLength(4);
  });

  it("keeps direct feasibility available when flexible resources are absent", () => {
    const input = workspace();
    input.workloads = [];
    input.batteryAssets = [];
    const result = prepareCanonicalFacilityPlan(input);
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain("No evidenced workload portfolio is available; workload response is zero.");
    expect(result.warnings).toContain("No battery asset configuration is available; battery response is zero.");
  });
});
