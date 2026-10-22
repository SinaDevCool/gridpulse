import { describe, expect, it } from "vitest";
import { buildOperationsScenario, defaultOperationsScenario } from "../scenario-engine";
import { overviewResultSchema } from "../transport-contracts";
import { scopeOperationsModel } from "../operating-context";
import { selectPowerView } from "./select-power-view";
import { historicalBatteryPoints, selectBatteryWorkspace } from "./select-battery-workspace";

describe("battery response workspace", () => {
  it("explains the 48 MW target: power limited, then protected reserve reached", () => {
    const model = buildOperationsScenario({ ...defaultOperationsScenario, importLimitMw: 50 });
    const result = selectBatteryWorkspace(model);
    const peak = result.points.find((point) => point.timestamp.includes("T08:00"))!;
    expect(peak.targetMw).toBe(48);
    expect(peak.facilityDemandMw! - peak.targetMw).toBeCloseTo(58.6, 0);
    expect(peak.batteryPowerMw).toBe(5);
    expect(peak.shortfallMw).toBeCloseTo(53.6, 0);
    expect(peak.constraintCode).toBe("power_limited");
    expect(peak.startingSocPercent!).toBeGreaterThan(peak.socPercent!);
    expect(peak.endTimestamp).toBe("2026-09-26T08:15:00.000Z");
    expect(result.events.find((event) => event.kind === "reserve")?.timestamp).toContain("T08:30");
    expect(result.targetMet).toBe(false);
    expect(result.reserveProtected).toBe(true);
    expect(result.segments.some((segment) => segment.code === "soc_minimum")).toBe(true);
    expect(result.segments.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(1440);
  });
  it("preserves engine start/end energy through the transport contract", () => {
    const model = buildOperationsScenario();
    const parsed = overviewResultSchema.parse(model);
    expect(parsed.intervals[0].batteryStartingSocPercent).toBe(
      model.scenario.battery.initialSocPercent,
    );
    model.intervals.forEach((point, index) => {
      expect(point.durationMinutes).toBe(15);
      expect(parsed.intervals[index].batteryEndingEnergyMwh).toBe(point.batteryEndingEnergyMwh);
      if (index)
        expect(point.batteryStartingEnergyMwh).toBeCloseTo(
          model.intervals[index - 1].batteryEndingEnergyMwh!,
          10,
        );
    });
    expect(() =>
      overviewResultSchema.parse({
        ...model,
        intervals: [{ ...model.intervals[0], durationMinutes: -1 }],
      }),
    ).toThrow();
  });
  it("does not reset SOC or events for an assessed-peak display window", () => {
    const model = buildOperationsScenario({ ...defaultOperationsScenario, importLimitMw: 50 });
    const scoped = scopeOperationsModel(model, "now");
    const view = selectPowerView(model, scoped, "scenario", [], [], null);
    expect(view.workspace.points).toHaveLength(96);
    expect(view.series).toHaveLength(scoped.intervals.length);
    expect(view.selectedPoint?.socPercent).toBe(view.selectedScenario.batterySocPercent);
    expect(view.workspace.events).toEqual(selectBatteryWorkspace(model).events);
  });
  it("distinguishes no response from sufficient power and energy", () => {
    const idle = selectBatteryWorkspace(
      buildOperationsScenario({ ...defaultOperationsScenario, importLimitMw: 120 }),
    );
    expect(idle.targetMet).toBe(true);
    expect(idle.dischargeMinutes).toBe(0);
    const sufficient = selectBatteryWorkspace(
      buildOperationsScenario({
        ...defaultOperationsScenario,
        battery: {
          ...defaultOperationsScenario.battery,
          maximumPowerMw: 20,
          usableEnergyMwh: 1000,
        },
      }),
    );
    expect(sufficient.targetMet).toBe(true);
    expect(sufficient.reserveProtected).toBe(true);
    expect(sufficient.points.some((point) => point.batteryPowerMw! < 0)).toBe(true);
  });
  it("does not confuse high MW capability with sufficient energy", () => {
    const result = selectBatteryWorkspace(
      buildOperationsScenario({
        ...defaultOperationsScenario,
        battery: { ...defaultOperationsScenario.battery, maximumPowerMw: 50, usableEnergyMwh: 1 },
      }),
    );
    expect(result.targetMet).toBe(false);
    expect(result.reserveProtected).toBe(true);
    expect(
      result.points.some((point) =>
        ["energy_limited", "soc_minimum"].includes(point.constraintCode),
      ),
    ).toBe(true);
  });
  it("shows unavailable equipment and impossible backup protection explicitly", () => {
    const unavailable = selectBatteryWorkspace(
      buildOperationsScenario({
        ...defaultOperationsScenario,
        battery: { ...defaultOperationsScenario.battery, inverterAvailable: false },
      }),
    );
    expect(unavailable.points.every((point) => point.batteryPowerMw === 0)).toBe(true);
    expect(unavailable.events.some((event) => event.kind === "availability")).toBe(true);
    const backup = selectBatteryWorkspace(
      buildOperationsScenario({
        ...defaultOperationsScenario,
        battery: {
          ...defaultOperationsScenario.battery,
          criticalLoadMw: 100,
          backupAutonomyMinutes: 120,
        },
      }),
    );
    expect(backup.protectedSocPercent).toBeGreaterThan(100);
    expect(backup.reserveProtected).toBe(false);
  });
  it("keeps historical evidence unknown and respects each declared limit", () => {
    const points = historicalBatteryPoints(
      [
        {
          timestamp: "2026-09-26T00:00:00Z",
          label: "00:00",
          gridImportMw: 99,
          facilityDemandMw: null,
          batteryPowerMw: null,
          socPercent: null,
          operatingLimitMw: 90,
          battery: null,
        },
        {
          timestamp: "2026-09-26T00:15:00Z",
          label: "00:15",
          gridImportMw: 99,
          facilityDemandMw: 102,
          batteryPowerMw: 3,
          socPercent: 60,
          operatingLimitMw: 100,
          battery: null,
        },
      ],
      100,
      2,
    );
    expect(points[0]).toMatchObject({
      constraintCode: "missing_evidence",
      startingSocPercent: null,
      endTimestamp: null,
      limitMw: 90,
      targetMw: 88,
    });
    expect(points[1]).toMatchObject({
      constraintCode: "observed",
      availableDischargeMw: null,
      limitMw: 100,
      targetMw: 98,
    });
  });
});
