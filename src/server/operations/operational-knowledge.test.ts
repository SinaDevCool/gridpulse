import { describe, expect, it } from "vitest";
import { retrieveOperationalKnowledge, operationalKnowledge } from "./operational-knowledge";
describe("reviewed operational retrieval", () => {
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
});
