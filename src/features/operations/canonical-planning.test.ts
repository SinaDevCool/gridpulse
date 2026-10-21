import { describe, expect, it } from "vitest";
import { operationsWorkspaceSchema } from "./workspace-contract";
import { prepareCanonicalFacilityPlan } from "./canonical-planning";
import { scenarioPlanningTime } from "./planning-time";

function workspace() {
  return operationsWorkspaceSchema.parse({
    schemaVersion: "gridpulse-operations-workspace-v1",
    generatedAt: "2026-10-06T09:00:00.000Z",
    automaticDispatchAuthorized: false,
    facility: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Berlin AI Campus",
      timezone: "Europe/Berlin",
      contractedImportLimitMw: 100,
      limitEvidence: "operator_confirmed",
      limitValidUntil: null,
    },
    sources: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "facility_meter",
        name: "Main meter",
        health: "healthy",
        readOnly: true,
        lastReceivedAt: "2026-10-06T08:45:00.000Z",
        latestEventAt: "2026-10-06T08:45:00.000Z",
        consecutiveFailures: 0,
        lastErrorCode: null,
      },
    ],
    measurements: [0, 15, 30, 45].map((minute) => ({
      metricKey: "facility_grid_import_mw",
      assetId: "facility",
      eventAt: `2026-10-06T08:${String(minute).padStart(2, "0")}:00.000Z`,
      value: 90 + minute / 15,
      unit: "MW",
      valueKind: "observed",
      quality: "accepted",
      sourceId: "22222222-2222-4222-8222-222222222222",
    })),
    batteryAssets: [{ id: "battery" }],
    workloads: [{ id: "workload" }],
    latestForecast: null,
    latestRecommendation: null,
    latestVerification: null,
    dataQuality: null,
    readiness: { mode: "historical", blockers: [], freshestEvidenceAt: "2026-10-06T08:45:00.000Z" },
  });
}

describe("canonical Operations plan preparation", () => {
  it("fails closed rather than inventing electrical parameters", () => {
    const result = prepareCanonicalFacilityPlan(workspace());
    expect(result.ready).toBe(false);
    expect(result.blockers.join(" ")).toContain("reviewed canonical facility model");
    expect(result.request).toBeNull();
  });

  it("keeps direct feasibility available when flexible resources are absent", () => {
    const input = workspace();
    input.workloads = [];
    input.batteryAssets = [];
    const result = prepareCanonicalFacilityPlan(input);
    expect(result.ready).toBe(false);
    expect(result.warnings).toContain(
      "No evidenced workload portfolio is available; workload scheduling cannot be validated.",
    );
    expect(result.warnings).toContain(
      "No battery asset configuration is available; battery response is zero.",
    );
  });
  it("requires a matching time contract before forwarding an approved request", () => {
    const w = workspace();
    const time = scenarioPlanningTime(
      w.measurements.map((p) => ({ timestamp: p.eventAt })),
      w.generatedAt,
    );
    const request = {
      schema_version: "gridpulse-facility-plan-request-v1" as const,
      portfolio_id: "test",
      facility: { facility_id: w.facility.id, import_limit_mw: 100, truth_class: "customer" },
      requirement: { truth_class: "customer" },
      intervals: time.intervals.map((p, index) => ({ index, start: p.start })),
      workloads: [{ workload_id: "test" }],
      profiles: [{ workload_id: "test", points: [] }],
      policy: { event_intervals: [false, false, false, false] },
      economics: { import_price_eur_per_mwh: [0, 0, 0, 0] },
      cooling: {},
    };
    expect(prepareCanonicalFacilityPlan(w, request).blockers.join(" ")).toContain(
      "planning-time contract",
    );
    expect(prepareCanonicalFacilityPlan(w, request, time).blockers.join(" ")).toContain(
      "synthetic scenario",
    );
    const historical = { ...time, purpose: "historical" as const };
    expect(prepareCanonicalFacilityPlan(w, request, historical).ready).toBe(true);
    expect(
      prepareCanonicalFacilityPlan(w, request, {
        ...historical,
        assessedAt: "2026-10-06T08:30:00Z",
      }).blockers.join(" "),
    ).toContain("cutoff differs");
    request.intervals[0].start = "2026-10-06T07:00:00Z";
    expect(prepareCanonicalFacilityPlan(w, request, historical).blockers.join(" ")).toContain(
      "intervals differ",
    );
  });
});
