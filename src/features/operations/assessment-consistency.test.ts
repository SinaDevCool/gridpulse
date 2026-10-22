import { describe, expect, it } from "vitest";
import { buildOperationsScenario, defaultOperationsScenario } from "./scenario-engine";
import { assessOperationsQuality, verifyOperationsResponse } from "./operations-assurance";
import { buildAssessmentPlan, emptyAssessmentEvidence } from "./assessment-plan";
import { buildScenarioWorkloads } from "./workload-intelligence";
import { parseBatteryCsv, parseFacilityPowerCsv } from "./battery-dispatch";
import { assessmentInput, assessmentQueryKey } from "./assessment-input";
import { scopeOperationsModel } from "./operating-context";
import { overviewResultSchema } from "./transport-contracts";
import { selectPowerView } from "./power/select-power-view";
import { assessGermanEvidence } from "./german-evidence";
import { simulateBatteryDispatch } from "./battery-dispatch";

describe("shared assessment invariants", () => {
  it("protects declared backup energy without creating energy when it is unavailable", () => {
    const config = {
      ...defaultOperationsScenario.battery,
      maximumDischargePowerMw: 5,
      usableEnergyMwh: 10,
      stateOfHealthPercent: 100,
      initialSocPercent: 80,
      minimumSocPercent: 20,
      dischargeEfficiency: 1,
      criticalLoadMw: 6,
      backupAutonomyMinutes: 60,
    };
    const inputs = Array.from({ length: 8 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, i * 15)).toISOString(),
      facilityDemandMw: 110,
      targetImportMw: 100,
    }));
    const result = simulateBatteryDispatch(inputs, config, 15);
    expect(result.at(-1)!.endingEnergyMwh).toBeCloseTo(6);
    expect(result.reduce((energy, point) => energy + point.batteryPowerMw * 0.25, 0)).toBeCloseTo(
      2,
    );
    const insufficient = simulateBatteryDispatch(inputs, { ...config, criticalLoadMw: 20 }, 15);
    expect(insufficient[0].constraintCode).toBe("constraint_conflict");
    expect(insufficient[0].endingEnergyMwh).toBe(8);
    expect(insufficient.every((point) => point.batteryPowerMw === 0)).toBe(true);
  });
  it("never certifies German compliance from scenario values or unreviewed evidence", () => {
    const result = assessGermanEvidence(undefined, "2026-10-22T08:00:00Z");
    expect(result.legalComplianceConfirmed).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.euReportingScope).toBeNull();
    const incomplete = assessGermanEvidence(
      {
        commissionedAt: "2026-08-01T00:00:00Z",
        periodStart: "2026-10-01T00:00:00Z",
        periodEnd: "2026-11-01T00:00:00Z",
        nonRedundantConnectionKw: 1000,
        installedItKw: 600,
        publicOperator: false,
        facilityBoundaryReviewed: false,
        renewableEvidenceReviewed: false,
        heatEvidenceReviewed: false,
        managementSystemEvidenceReviewed: false,
        rulesReviewedAt: "2025-01-01T00:00:00Z",
      },
      "2026-10-22T08:00:00Z",
    );
    expect(incomplete.euReportingScope).toBe(true);
    expect(incomplete.legalComplianceConfirmed).toBe(false);
    expect(incomplete.missing.length).toBeGreaterThan(4);
  });
  it("does not shift other facility load as compute flexibility", () => {
    const model = buildOperationsScenario({
      ...defaultOperationsScenario,
      gpuCount: 1,
      nonGpuBaseLoadMw: 150,
    });
    for (const point of model.intervals) {
      expect(point.workloadShiftMw).toBeLessThanOrEqual(0.001);
      expect(point.workloadOnlyShiftMw).toBeLessThanOrEqual(0.001);
    }
  });
  it("keeps synthetic GPU allocations within configured inventory, including tiny sites", () => {
    for (const gpuCount of [1, 20, 80_000, 125_000]) {
      const jobs = buildScenarioWorkloads(
        buildOperationsScenario({ ...defaultOperationsScenario, gpuCount }),
      );
      expect(jobs.reduce((sum, job) => sum + job.requestedGpuCount, 0)).toBeLessThanOrEqual(
        gpuCount,
      );
    }
  });
  it("never certifies zero delivery or hides an import increase", () => {
    const result = verifyOperationsResponse({
      requestedReductionMw: 5,
      expectedImportMw: 95,
      actualImportMw: [100, 105],
      baselineImportMw: [100, 100],
      intervalMinutes: 15,
      telemetryCompletenessPercent: 100,
    });
    expect(result).toMatchObject({
      verified: false,
      dataEvaluable: true,
      performanceAchieved: false,
      baselineValidated: false,
    });
    expect(result.deliveredReductionMw).toBe(-2.5);
  });
  it("blocks duplicate and stale quality even with otherwise complete evidence", () => {
    const result = assessOperationsQuality({
      expectedIntervals: 4,
      receivedIntervals: 4,
      duplicateCount: 1,
      staleCount: 1,
      newestEvidenceAt: "2026-10-22T08:00:00Z",
      assessedAt: "2026-10-22T08:01:00Z",
    });
    expect(result.status).not.toBe("ready");
  });
  it("validates timezone and duplicates even for single/small CSV imports", () => {
    expect(() => parseFacilityPowerCsv("timestamp,grid_import_mw\n2026-10-25T02:00:00,10")).toThrow(
      /UTC offset/,
    );
    expect(() =>
      parseFacilityPowerCsv(
        "timestamp,grid_import_mw\n2026-10-22T08:00:00Z,10\n2026-10-22T10:00:00+02:00,11",
      ),
    ).toThrow(/Duplicate/);
    expect(() =>
      parseBatteryCsv("timestamp,soc_percent,active_power_mw\n2026-10-25T02:00:00,50,1"),
    ).toThrow(/UTC offset/);
  });
  it("caps scenario curves by imported job windows, without claiming a validated schedule", () => {
    const original = buildAssessmentPlan(defaultOperationsScenario);
    const job = {
      ...buildScenarioWorkloads(original)[0],
      source: "csv" as const,
      earliestStart: "2026-09-25T00:00:00Z",
      deadline: "2026-09-25T23:00:00Z",
    };
    const result = buildAssessmentPlan(defaultOperationsScenario, {
      ...emptyAssessmentEvidence,
      workloads: [job],
    });
    expect(result.intervals.every((point) => point.workloadShiftMw === 0)).toBe(true);
    expect(result.assessmentPlan.workloads.recommendedJobs).toBe(0);
    expect(result.assessmentPlan.status.scheduleValidated).toBe(false);
    expect(overviewResultSchema.safeParse(result).success).toBe(true);
  });
  it("keeps evidence changes in request identity and display filtering out of it", () => {
    const input = assessmentInput(defaultOperationsScenario, emptyAssessmentEvidence);
    const changed = assessmentInput(defaultOperationsScenario, {
      ...emptyAssessmentEvidence,
      facility: [{ timestamp: "2026-09-26T08:00:00Z", facilityImportMw: 99, operatingLimitMw: 90 }],
    });
    expect(assessmentQueryKey(input)).not.toEqual(assessmentQueryKey(changed));
    const model = buildAssessmentPlan(defaultOperationsScenario, changed.evidence);
    const scoped = scopeOperationsModel(model, "now");
    expect(scoped.assessmentPlan).toEqual(model.assessmentPlan);
    const power = selectPowerView(model, model, "historical", changed.evidence.facility, [], null);
    expect(power.targetMw).toBe(88);
    expect(model.assessmentPlan.baselineSource).toBe("synthetic");
  });
  it("limits advertised battery support by state-dependent ramp capability", () => {
    const model = buildOperationsScenario({
      ...defaultOperationsScenario,
      battery: { ...defaultOperationsScenario.battery, rampRateMwPerMinute: 0.01 },
    });
    expect(model.intervals[0].availableDischargeMw).toBeLessThanOrEqual(0.15);
    model.operatingEnvelope.intervals.forEach((point, index) => {
      expect(point.batteryCeilingMw - point.directCeilingMw).toBeLessThanOrEqual(
        model.intervals[index].availableDischargeMw + 0.011,
      );
    });
  });
});
