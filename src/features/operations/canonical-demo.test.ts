import { describe, expect, it } from "vitest";
import { selectCanonicalDemo } from "./canonical-demo";

import { snapshot } from "../../../tests/fixtures/canonical-demo";

describe("synthetic MILP presentation adapter", () => {
  it("uses canonical dispatch and battery energy, without heuristic substitution", () => {
    const demo = selectCanonicalDemo(snapshot());
    expect(demo.points[0].socPercent).toBe(50);
    expect(demo.points[0].startingSocPercent).toBe(75);
    expect(demo.points[0].batteryPowerMw).toBe(0.1);
    expect(demo.protectedSocPercent).toBe(20);
    expect(demo.baselinePeakMw).toBe(1.2);
    expect(demo.jobs[0].points[0].status).toBe("running");
    expect(demo.projected.overview.identity).toBe(demo.projected.compute.identity);
  });
  it("rejects a customer facility, invalid battery data and resource mismatch", () => {
    const customer = snapshot(); customer.request.facility.facility_id = "customer";
    expect(() => selectCanonicalDemo(customer)).toThrow();
    const invalid = snapshot(); invalid.result.result.battery_trajectories[0].points[0].usable_energy_mwh = 0;
    expect(() => selectCanonicalDemo(invalid)).toThrow();
    const mismatch = snapshot(); mismatch.request.workloads[0].workload_id = "other";
    expect(() => selectCanonicalDemo(mismatch)).toThrow();
  });
});
