import { describe, expect, it } from "vitest";
import { resolveMapSourceSummary, sourceSupportsKind } from "./map-source-registry";
import type { PowerFinderCollection } from "@/features/power-finder/fixture-data";

function collection(
  status: PowerFinderCollection["metadata"]["coverage_status"],
): PowerFinderCollection {
  return {
    type: "FeatureCollection",
    features: [],
    metadata: {
      title: "Germany public map",
      source_id: "release-1",
      publisher: "Bundesnetzagentur / OpenStreetMap contributors",
      licence: "ODbL / DL-DE-BY-2.0",
      attribution: "Public sources",
      published_at: "2026-08-10T00:00:00Z",
      geographic_scope: "DE",
      freshness: "current",
      artifact_sha256: "abc",
      record_count: 0,
      available_kinds: ["node", "line"],
      kind_counts: { node: 10, line: 20 },
      coverage_status: status,
      evidence_boundary: "Screening context only.",
    },
  };
}

describe("map source registry", () => {
  it("does not let fallback viewport metadata hide a healthy registry tile source", () => {
    const result = resolveMapSourceSummary(collection("accepted_static_fallback"), {
      registry: "ready",
    });
    expect(result.health).toBe("live");
  });

  it("preserves explicit layer coverage", () => {
    const result = resolveMapSourceSummary(collection("accepted_partial"));
    expect(sourceSupportsKind(result, "line")).toBe(true);
    expect(sourceSupportsKind(result, "generation_asset")).toBe(false);
  });
});
