import { describe, expect, it } from "vitest";
import { calculateFlexibility, calculateMaturity, canIssueOperatorPackage } from "./calculations";

describe("German connection planning calculations", () => {
  it("scores only evidenced project-maturity gates", () => {
    const result = calculateMaturity({
      projectKind: "ai_hpc_data_centre",
      latitude: 50.1,
      longitude: 8.6,
      requestedImportMw: 80,
      minimumViableImportMw: 50,
      requestedExportMw: 0,
      landStatus: "controlled",
      planningStatus: "submitted",
      singleLineDiagramReady: true,
      cableRouteStatus: "indicative",
      financeStatus: "committed",
    });
    expect(result.score).toBe(80);
    expect(result.blockers).toEqual(["cable_route"]);
  });

  it("uses shifting and duration-adjusted storage before reporting residual shortfall", () => {
    const result = calculateFlexibility({
      requestedImportMw: 80,
      firmImportMw: 50,
      conditionalImportMw: 10,
      minimumCriticalLoadMw: 45,
      shiftableLoadMw: 10,
      batteryPowerMw: 10,
      batteryEnergyMwh: 20,
      restrictionDurationHours: 2,
      restrictionEventsPerYear: 20,
      energyValueEurMwh: 200,
      batteryDegradationEurMwh: 20,
    });
    expect(result.grossShortfallMw).toBe(20);
    expect(result.shiftableContributionMw).toBe(10);
    expect(result.batteryContributionMw).toBe(10);
    expect(result.residualShortfallMw).toBe(0);
    expect(result.compatible).toBe(true);
    expect(result.classification).toBe("requires_operator_study");
  });

  it("does not call an envelope compatible when critical load exceeds supplied capacity", () => {
    const result = calculateFlexibility({
      requestedImportMw: 80,
      firmImportMw: 30,
      conditionalImportMw: 10,
      minimumCriticalLoadMw: 50,
      shiftableLoadMw: 30,
      batteryPowerMw: 10,
      batteryEnergyMwh: 20,
      restrictionDurationHours: 2,
      restrictionEventsPerYear: 10,
      energyValueEurMwh: 200,
      batteryDegradationEurMwh: 20,
    });
    expect(result.compatible).toBe(false);
    expect(result.warnings[0]).toContain("minimum critical load");
  });

  it("blocks an operator package until evidence, maturity and a profile exist", () => {
    expect(
      canIssueOperatorPackage({
        evidenceReady: true,
        siteMaturityScore: 80,
        hasLoadProfile: false,
      }),
    ).toEqual({ ready: false, blockers: ["Add a representative interval load profile"] });
  });
});
