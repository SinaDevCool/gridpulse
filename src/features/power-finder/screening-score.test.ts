import { describe, expect, it } from "vitest";
import type { PowerFinderFeature } from "./fixture-data";
import { scoreFeature } from "./screening-score";

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

describe("Power Finder screening context score", () => {
  it("does not award capacity points when capacity is unknown", () => {
    const result = scoreFeature(
      node({ voltage_kv: [110], operator: "Mapped operator", status: "operational" }),
    );
    expect(
      result?.components.find((component) => component.label.includes("capacity"))?.points,
    ).toBe(0);
    expect(result?.boundary).toContain("not a probability of connection");
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
    expect(result?.label).toBe("strong screening context");
  });

  it("does not score non-node context", () => {
    const feature = node();
    feature.properties.kind = "industrial_site";
    expect(scoreFeature(feature)).toBeNull();
  });
});
