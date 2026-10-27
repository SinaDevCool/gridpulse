import { describe, expect, it } from "vitest";
import { retrieveOperationalKnowledge, operationalKnowledge } from "./operational-knowledge";
describe("reviewed operational retrieval", () => {
  it("does not supply report guidance as calibration or dispatch evidence", () => {
    expect(retrieveOperationalKnowledge("battery capacity", { purpose: "site_calibration" })).toEqual([]);
    expect(retrieveOperationalKnowledge("battery capacity", { purpose: "dispatch_authorisation" })).toEqual([]);
    expect(retrieveOperationalKnowledge("battery capacity", { intents: ["why"] })).toEqual([]);
  });
  it("ranks bounded guidance with explicit source and applicability", () => {
    const result = retrieveOperationalKnowledge("PUE facility overhead efficiency");
    expect(result[0].id).toBe("pue-boundary");
    expect(result.length).toBeLessThanOrEqual(4);
    expect(result.every(item => item.source.startsWith("https://") && item.version && item.applicability && item.section)).toBe(true);
    expect(retrieveOperationalKnowledge("hello")).toEqual([]);
    expect(new Set(operationalKnowledge.map(item => item.id)).size).toBe(operationalKnowledge.length);
  });
  it("keeps measurement and approval gaps discoverable", () => {
    expect(retrieveOperationalKnowledge("missing telemetry measurements approval").some(item => item.id === "metering-readiness")).toBe(true);
  });
  it("preserves report scope and page provenance without treating protocols as site qualification", () => {
    const result = retrieveOperationalKnowledge("OpenADR protocol EEBUS Matter");
    const report = result.find(item => item.id === "edna-protocol-scope");
    expect(report).toMatchObject({ sourceId: "B02", pdfPages: [6, 9], evidenceClass: "report_guidance" });
    expect(report?.text).toContain("residential");
    expect(report).toHaveProperty("excludedUses", expect.arrayContaining(["dispatch_authorisation"]));
  });
});

it("retrieves German reporting and connection terminology", () => {
  expect(retrieveOperationalKnowledge("Welche Berichtspflichten gelten?").some(item => item.id === "de-reporting")).toBe(true);
  expect(retrieveOperationalKnowledge("Netzanschlussvertrag").some(item => item.id === "de-flexible-connection")).toBe(true);
});
