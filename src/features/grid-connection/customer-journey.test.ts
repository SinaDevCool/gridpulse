import { describe, expect, it } from "vitest";
import { buildCustomerPathways } from "./customer-journey";

describe("buildCustomerPathways", () => {
  it("only marks staged energisation as a candidate when the first stage is below the request", () => {
    const pathways = buildCustomerPathways({
      requestedImportMw: 100,
      minimumViableImportMw: 40,
      hasIntervalProfile: false,
    });
    expect(pathways.find((item) => item.key === "staged")).toMatchObject({
      candidate: true,
      status: "Candidate for operator discussion",
    });
    expect(pathways.find((item) => item.key === "flexible")?.candidate).toBe(false);
  });

  it("does not present an equal or missing minimum as a staged option", () => {
    for (const minimumViableImportMw of [null, 100, 120]) {
      const staged = buildCustomerPathways({
        requestedImportMw: 100,
        minimumViableImportMw,
        hasIntervalProfile: false,
      }).find((item) => item.key === "staged");
      expect(staged?.candidate).toBe(false);
    }
  });

  it("marks flexibility as analysis-ready only when an interval profile exists", () => {
    const flexible = buildCustomerPathways({
      requestedImportMw: 80,
      minimumViableImportMw: 30,
      hasIntervalProfile: true,
    }).find((item) => item.key === "flexible");
    expect(flexible).toMatchObject({
      candidate: true,
      status: "Profile available for scenario analysis",
    });
  });
});
