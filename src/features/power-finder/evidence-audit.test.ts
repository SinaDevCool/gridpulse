import { describe, expect, it } from "vitest";
import { classifyInfrastructure } from "./infrastructure-suitability";
import { resolveCandidateOperatorContext } from "./candidate-detail-model";
import { emptyGermanyPowerFinderCollection } from "./fixture-data";
import { sourcePublicationDate } from "./source-provenance";
import { rankCandidatesForLocation, applyPreferredVoltageContext } from "./candidate-intelligence";

describe("investigation evidence boundaries", () => {
  it("retains customer substations with a visible qualification limit", () => {
    const result = classifyInfrastructure("Umspannwerk Krankenhaus", "Hospital");
    expect(result.kind).toBe("possible_customer_asset");
    expect(result.scoreCeiling).toBeLessThan(100);
    expect(result.note).toContain("unverified");
    expect(classifyInfrastructure("Umspannwerk Nord", "Bayer AG").kind).toBe(
      "possible_customer_asset",
    );
    expect(classifyInfrastructure("Umspannwerk Nord", "Bayernwerk Netz GmbH").kind).not.toBe(
      "possible_customer_asset",
    );
  });
  it("does not promote another asset operator to DSO", () => {
    const candidate = { operator: "Bayer" } as Parameters<
      typeof resolveCandidateOperatorContext
    >[0];
    expect(
      resolveCandidateOperatorContext(candidate, [
        { name: "Bayer", type: "DSO / other", featureCount: 1, bounds: null, tsoNames: [] },
      ]).mappedRole,
    ).toBeNull();
  });
  it("never substitutes query time for a source publication", () => {
    const collection = emptyGermanyPowerFinderCollection();
    collection.metadata.published_at = "2026-11-21T00:00:00Z";
    collection.metadata.published_at_basis = "query_time";
    const feature = {
      type: "Feature" as const,
      id: "n",
      geometry: { type: "Point" as const, coordinates: [13, 52] },
      properties: { kind: "node" as const, name: "Node", evidence_class: "open_mapping" as const },
    };
    expect(sourcePublicationDate(collection, feature)).toBeNull();
    expect(
      rankCandidatesForLocation({ ...collection, features: [feature] }, 13, 52, 100, 20)
        .candidates[0].rankComponents?.sourceFreshness,
    ).toBe(30);
    expect(
      sourcePublicationDate(collection, {
        ...feature,
        properties: { ...feature.properties, source_published_at: "2025-01-01" },
      }),
    ).toBe("2025-01-01");
  });
  it("preserves customer-asset limits after preferred-voltage reranking", () => {
    const collection = emptyGermanyPowerFinderCollection();
    collection.features = [
      {
        type: "Feature",
        id: "private",
        geometry: { type: "Point", coordinates: [13, 52] },
        properties: {
          kind: "node",
          name: "Umspannwerk Bayer",
          operator: "Bayer",
          voltage_kv: [110],
          evidence_class: "open_mapping",
        },
      },
    ];
    const candidates = rankCandidatesForLocation(collection, 13, 52, 100, 20).candidates;
    expect(applyPreferredVoltageContext(candidates, 110)[0].screeningRank).toBeLessThanOrEqual(65);
  });
});
