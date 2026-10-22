import { describe, expect, it } from "vitest";
import { buildAssessmentPlan, emptyAssessmentEvidence } from "./assessment-plan";
import { runOperationsAssessment } from "./operations-service";
import {
  defaultOperationsScenario,
  type OperationsOverviewModel,
  type OperationsScenario,
} from "./scenario-engine";
import { scopeOperationsModel } from "./operating-context";
import { selectComputeTimeline } from "./compute/select-compute-timeline";
import { selectComputeSummary } from "./compute/select-compute-summary";
import { selectPowerView } from "./power/select-power-view";
import { selectOperatingSummary } from "./overview/select-operating-summary";
import { buildScenarioWorkloads } from "./workload-intelligence";

const base = defaultOperationsScenario;
const battery = (change: Partial<OperationsScenario["battery"]>) => ({
  ...base,
  battery: { ...base.battery, ...change },
});
const cases: [string, OperationsScenario][] = [
  ["facility limit", { ...base, importLimitMw: 85 }],
  ["safety reserve", { ...base, safetyReserveMw: 10 }],
  ["GPU count", { ...base, gpuCount: 180_000 }],
  ["GPU active power", { ...base, gpuActivePowerWatts: 900 }],
  ["GPU idle power", { ...base, gpuIdlePowerWatts: 200 }],
  ["PUE", { ...base, pue: 1.5 }],
  ["other facility load", { ...base, nonGpuBaseLoadMw: 35 }],
  ["flexibility", { ...base, maximumShiftablePercent: 0 }],
  ["maximum delay", { ...base, maximumDelayMinutes: 0 }],
  ["discharge power", battery({ maximumPowerMw: 0 })],
  ["charge power", battery({ maximumChargePowerMw: 0 })],
  ["battery energy", battery({ usableEnergyMwh: 2 })],
  ["initial SOC", battery({ initialSocPercent: 25 })],
  ["reserve SOC", battery({ minimumSocPercent: 75 })],
  ["maximum SOC", battery({ maximumSocPercent: 80 })],
  ["state of health", battery({ stateOfHealthPercent: 25 })],
  ["charge efficiency", battery({ chargeEfficiency: 0.5 })],
  ["discharge efficiency", battery({ dischargeEfficiency: 0.5 })],
  ["ramp rate", battery({ rampRateMwPerMinute: 0.01 })],
  ["minimum dwell", battery({ minimumDwellMinutes: 120 })],
  ["availability", battery({ available: false })],
  ["inverter availability", battery({ inverterAvailable: false })],
  ["backup reserve", battery({ criticalLoadMw: 20, backupAutonomyMinutes: 120 })],
];

describe("one backend assessment feeds every tab", () => {
  it("changes demand for physical compute inputs but preserves demand when only battery availability changes", () => {
    const original = buildAssessmentPlan(base);
    for (const scenario of cases.slice(2, 7).map(([, scenario]) => scenario)) {
      const changed = buildAssessmentPlan(scenario);
      expect(changed.intervals.map((p) => p.baselineDemandMw)).not.toEqual(
        original.intervals.map((p) => p.baselineDemandMw),
      );
    }
    const unavailable = buildAssessmentPlan(battery({ available: false }));
    expect(unavailable.intervals.map((p) => p.gpuPowerMw)).toEqual(
      original.intervals.map((p) => p.gpuPowerMw),
    );
    expect(unavailable.intervals.every((p) => p.batteryPowerMw === 0)).toBe(true);
    for (const scenario of [
      { ...base, maximumShiftablePercent: 0 },
      { ...base, maximumDelayMinutes: 0 },
    ]) {
      const changed = buildAssessmentPlan(scenario);
      expect(
        changed.intervals.every((p) => p.workloadShiftMw === 0 && p.workloadRecoveryMw === 0),
      ).toBe(true);
      expect(changed.intervals.map((p) => p.combinedDemandMw)).toEqual(
        changed.intervals.map((p) => p.batteryDemandMw),
      );
    }
  });
  it.each(cases)(
    "projects %s consistently without recalculating a display window",
    (_, scenario) => {
      const model = runOperationsAssessment({ kind: "overview", scenario })
        .result as OperationsOverviewModel;
      const snapshot = JSON.stringify(model);
      const target = scenario.importLimitMw - scenario.safetyReserveMw;
      const compute = selectComputeSummary(model.assessmentPlan!.workloads, model);
      expect(compute.required).toBeCloseTo(
        Math.max(0, model.summaries.find((s) => s.kind === "battery")!.peakDemandMw - target),
        1,
      );
      expect(compute.unrecovered).toBe(
        model.summaries.find((s) => s.kind === "battery_workload")!.unresolvedWorkMwh,
      );
      expect(model.metrics.facilityDemand.value).toBe(
        model.summaries.find((s) => s.kind === "battery_workload")!.peakDemandMw,
      );
      for (const window of ["now", "next-4h", "today"] as const) {
        const scoped = scopeOperationsModel(model, window);
        const power = selectPowerView(model, scoped, "scenario", [], [], null);
        const timeline = selectComputeTimeline(scoped.intervals, target);
        expect(power.series).toHaveLength(scoped.intervals.length);
        for (const [i, point] of scoped.intervals.entries()) {
          expect(timeline[i].gpuPowerMw).toBe(point.gpuPowerMw);
          expect(timeline[i].combinedDemandMw).toBe(point.combinedDemandMw);
          expect(timeline[i].requiredWorkloadMw).toBeCloseTo(
            Math.max(0, point.batteryDemandMw - target),
          );
          expect(power.series[i].gridImportMw).toBe(point.batteryDemandMw);
          expect(power.series[i].batteryPowerMw).toBe(point.batteryPowerMw);
          expect(power.series[i].socPercent).toBe(point.batterySocPercent);
          const overview = selectOperatingSummary(scoped, "battery", point.timestamp);
          expect(overview.response).toBeCloseTo(point.batteryPowerMw, 1);
          expect(power.series[i].gridImportMw + (power.series[i].batteryPowerMw ?? 0)).toBeCloseTo(
            point.baselineDemandMw,
            1,
          );
        }
        expect(scoped.assessmentPlan).toBe(model.assessmentPlan);
        expect(scoped.summaries.find((s) => s.kind === "battery_workload")!.unresolvedWorkMwh).toBe(
          compute.unrecovered,
        );
      }
      expect(JSON.stringify(model)).toBe(snapshot);
    },
  );

  it("reports the actual response peak when battery depletion moves the peak away from the baseline peak", () => {
    const model = buildAssessmentPlan({
      ...battery({ usableEnergyMwh: 1 }),
      gpuIdlePowerWatts: 700,
      maximumShiftablePercent: 0,
    });
    const baselinePeak = model.intervals.reduce((a, b) =>
      b.baselineDemandMw > a.baselineDemandMw ? b : a,
    );
    expect(baselinePeak.combinedDemandMw).toBeLessThan(
      Math.max(...model.intervals.map((p) => p.combinedDemandMw)),
    );
    expect(model.metrics.facilityDemand.value).toBeCloseTo(
      Math.max(...model.intervals.map((p) => p.combinedDemandMw)),
      1,
    );
  });

  it("keeps standalone compute and shared overview identical for imported job windows", () => {
    const scenarioModel = buildAssessmentPlan(base);
    const jobs = buildScenarioWorkloads(scenarioModel).map((job) => ({
      ...job,
      source: "csv" as const,
    }));
    const shared = buildAssessmentPlan(base, { ...emptyAssessmentEvidence, workloads: jobs });
    const standalone = runOperationsAssessment({
      kind: "compute",
      scenario: base,
      workloads: jobs,
      telemetry: [],
    });
    expect(standalone.result).toEqual(shared.assessmentPlan!.workloads);
    expect(() =>
      runOperationsAssessment({
        kind: "compute",
        scenario: base,
        workloads: [jobs[0], jobs[0]],
        telemetry: [],
      }),
    ).toThrow(/Duplicate workload/);
  });

  it("does not treat descriptive labels as new power profiles", () => {
    const first = buildAssessmentPlan(base);
    const labelled = buildAssessmentPlan({
      ...base,
      facilityName: "Other name",
      gpuModel: "Another reference label",
    });
    expect(labelled.intervals).toEqual(first.intervals);
    expect(labelled.summaries).toEqual(first.summaries);
  });
});
