import { describe, expect, it } from "vitest";
import { emptyGermanyPowerFinderCollection } from "./fixture-data";
import { rankCandidatesForLocation } from "./candidate-intelligence";
import { buildScreeningEvidenceReceipt } from "./evidence-receipt";

function candidate() {
  const collection = emptyGermanyPowerFinderCollection();
  collection.features = [
    {
      type: "Feature",
      id: "test-node",
      geometry: { type: "Point", coordinates: [13, 52] },
      properties: { kind: "node", name: "Prüfstätte", evidence_class: "open_mapping" },
    },
  ];
  return rankCandidatesForLocation(collection, 13, 52, 100, 20).candidates[0];
}

describe("portable screening evidence", () => {
  it("keeps missing provenance and retrieval completeness unknown", () => {
    const receipt = buildScreeningEvidenceReceipt(candidate());
    expect(receipt).toContain("Source publication: Unknown");
    expect(receipt).toContain("Retrieved-input SHA-256: Not recorded");
    expect(receipt).toContain("completeness unknown");
    expect(receipt).toContain("remain unconfirmed");
  });
  it("retains a capped input identity without promising archived data or rights", () => {
    const receipt = buildScreeningEvidenceReceipt({
      ...candidate(),
      retrievalCapped: true,
      sourceSnapshotSha256: "a".repeat(64),
      sourcePublishedAt: "2026-10-01",
    });
    expect(receipt).toContain("Unresolved cap");
    expect(receipt).toContain("Source publication: 2026-10-01");
    expect(receipt).toContain("a".repeat(64));
    expect(receipt).toContain("does not archive that input");
    expect(receipt).toContain("grant reuse rights");
  });
});
