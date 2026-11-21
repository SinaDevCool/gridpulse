import type { RankedCandidateResult } from "./candidate-intelligence";
import type { PowerFinderCollection } from "./fixture-data";

/** Hash the exact retrieved input; this is not a claim that the source release is known. */
export async function attachScreeningSnapshot(
  result: RankedCandidateResult,
  collection: PowerFinderCollection,
): Promise<RankedCandidateResult> {
  const bytes = new TextEncoder().encode(JSON.stringify(collection));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sourceSnapshotSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    ...result,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      sourceSnapshotSha256,
      retrievalCapped: collection.metadata.retrieval_capped ?? false,
    })),
  };
}
