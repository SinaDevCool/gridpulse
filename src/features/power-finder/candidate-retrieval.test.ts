import { describe, expect, it, vi } from "vitest";
import { retrieveCandidateContext } from "./candidate-retrieval";
import { emptyGermanyPowerFinderCollection } from "./fixture-data";
import { finderSearchSchema } from "./search-contract";
import { scopeFallback } from "./fallback-scope";

const bounds = { west: 12, east: 14, south: 51, north: 53 };
describe("bounded candidate retrieval", () => {
  it("subdivides a capped collection and retains deduplicated context", async () => {
    const sample = (capped: boolean) => ({
      mode: "public_database" as const,
      collection: {
        ...emptyGermanyPowerFinderCollection(),
        metadata: { ...emptyGermanyPowerFinderCollection().metadata, retrieval_capped: capped },
      },
    });
    const loader = vi.fn().mockResolvedValueOnce(sample(true)).mockResolvedValue(sample(false));
    const result = await retrieveCandidateContext(bounds, loader);
    expect(loader).toHaveBeenCalledTimes(5);
    expect(result.collection.metadata.retrieval_capped).toBe(false);
  });
  it("bounds subdivision and discloses an unresolved cap", async () => {
    const collection = emptyGermanyPowerFinderCollection();
    collection.metadata.retrieval_capped = true;
    const loader = vi.fn().mockResolvedValue({ mode: "public_database", collection });
    expect(
      (await retrieveCandidateContext(bounds, loader)).collection.metadata.retrieval_capped,
    ).toBe(true);
    expect(loader).toHaveBeenCalledTimes(21);
  });
  it("never scopes Brandenburg features into an unrelated German region", () => {
    const collection = emptyGermanyPowerFinderCollection();
    collection.features = [
      {
        type: "Feature",
        id: "n",
        geometry: { type: "Point", coordinates: [13, 52] },
        properties: { kind: "node", name: "Node", evidence_class: "open_mapping" },
      },
    ];
    expect(scopeFallback(collection, { west: 7, east: 8, south: 48, north: 49 }).features).toEqual(
      [],
    );
    expect(scopeFallback(collection, bounds).metadata).toMatchObject({
      record_count: 1,
      published_at_basis: "source_release",
      coverage_status: "accepted_static_fallback",
    });
  });
  it("does not allow a public URL to enable hidden synthetic capacity", () => {
    expect(
      finderSearchSchema.parse({ mapMode: "capacity", capacitySource: "berlin_synthetic" }).mapMode,
    ).toBe("voltage");
  });
});
