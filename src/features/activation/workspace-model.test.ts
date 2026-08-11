import { describe, expect, it } from "vitest";
import { buildActivationWorkspaceModel } from "./workspace-model";

const site = {
  id: "site-1",
  name: "Gnewitz",
  project_type: "data_centre",
  requested_import_mw: 500,
  minimum_viable_import_mw: 400,
  bess_power_mw: 25,
  bess_energy_mwh: 50,
  likely_network_operator: "50Hertz",
};

describe("buildActivationWorkspaceModel", () => {
  it("uses transparent illustrative assumptions without an envelope", () => {
    const result = buildActivationWorkspaceModel(site, []);
    expect(result.firmMw).toBe(420);
    expect(result.flexibleMw).toBe(475);
    expect(result.activatedMw).toBe(500);
    expect(result.evidenceLabel).toBe("Illustrative assumption");
    expect(result.timeline).toHaveLength(168);
  });

  it("prioritises the latest stored envelope and never exceeds the request", () => {
    const result = buildActivationWorkspaceModel(site, [
      {
        id: "a",
        name: "A",
        version: 1,
        status: "draft",
        mode: "static",
        max_import_mw: 380,
        valid_from: null,
        valid_to: null,
        restriction_schedule: [],
      },
      {
        id: "b",
        name: "B",
        version: 2,
        status: "agreed",
        mode: "dynamic",
        max_import_mw: 440,
        valid_from: null,
        valid_to: null,
        restriction_schedule: [],
      },
    ]);
    expect(result.firmMw).toBe(440);
    expect(result.activatedMw).toBeLessThanOrEqual(500);
    expect(result.evidenceLabel).toBe("Operator-agreed envelope");
  });
});
