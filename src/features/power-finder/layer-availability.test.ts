import { describe, expect, it } from "vitest";
import { layerAvailability } from "./layer-availability";
import type { PowerFinderCollection } from "./fixture-data";

const collection = {
  type: "FeatureCollection",
  metadata: {
    title: "x", source_id: "x", publisher: "x", licence: "x", attribution: "x",
    published_at: "2026-01-01", geographic_scope: "x", freshness: "x",
    artifact_sha256: "x", record_count: 0, available_kinds: ["node"],
    kind_counts: { node: 0 }, evidence_boundary: "x",
  },
  features: [],
} satisfies PowerFinderCollection;

describe("layer availability", () => {
  it("distinguishes an empty viewport from a layer absent from the release", () => {
    expect(layerAvailability(collection, "node").reason).toBe("empty_release");
    expect(layerAvailability(collection, "storage_asset").reason).toBe("not_in_release");
  });
});
