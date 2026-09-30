import { describe, expect, it } from "vitest";
import type { PowerFinderFeature } from "./fixture-data";
import { evidenceConfidence, scoreFeature } from "./screening-score";

function node(overrides: Partial<PowerFinderFeature["properties"]> = {}): PowerFinderFeature {
  return {
    type: "Feature",
    id: "node-1",
    geometry: { type: "Point", coordinates: [13.2, 52.3] },
    properties: {
      kind: "node",
      name: "Node",
      evidence_class: "open_mapping",
      capacity_state: "not_established",
      ...overrides,
    },
  };
}

describe("Power Finder evidence readiness score", () => {
  it("does not include a capacity component", () => {
    const result = scoreFeature(
      node({ voltage_kv: [110], operator: "Mapped operator", status: "operational" }),
    );
    expect(result?.components.some((component) => /capacity/i.test(component.label))).toBe(false);
    expect(result?.boundary).toContain("does not establish technical compatibility");
  });

  it("rewards authoritative published observations without implying feasibility", () => {
    const result = scoreFeature(
      node({
        evidence_class: "official_operator",
        capacity_state: "published_exact",
        exact_mw: 80,
        voltage_kv: [380],
        operator: "Responsible operator",
        status: "operational",
      }),
    );
    expect(result?.total).toBe(100);
    expect(result?.label).toBe("higher evidence completeness");
  });

  it("does not score non-node context", () => {
    const feature = node();
    feature.properties.kind = "industrial_site";
    expect(scoreFeature(feature)).toBeNull();
  });

  it("classifies open mapping without presenting it as confirmed evidence", () => {
    const result = evidenceConfidence(
      node({
        voltage_kv: [110],
        operator: "Mapped operator",
        status: "operational",
        source_published_at: "2026-08-08T00:00:00Z",
      }),
    );
    expect(result.find((item) => item.label === "Voltage")?.level).toBe("mapped");
    expect(result.find((item) => item.label === "Operator Responsibility")?.level).toBe("mapped");
    expect(result.find((item) => item.label === "Operating Status")?.level).toBe("inferred");
    expect(result.find((item) => item.label === "Capacity Evidence")?.level).toBe("unknown");
  });

  it("reserves confirmed status for authoritative evidence", () => {
    const result = evidenceConfidence(
      node({
        evidence_class: "official_operator",
        voltage_kv: [110],
        operator: "Responsible operator",
        status: "operational",
        capacity_state: "published_exact",
        exact_mw: 40,
      }),
    );
    expect(result.find((item) => item.label === "Voltage")?.level).toBe("confirmed");
    expect(result.find((item) => item.label === "Capacity Evidence")?.level).toBe("confirmed");
  });
});
