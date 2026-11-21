import type { CandidateOpportunity } from "./candidate-intelligence";

/** Describes the ranked input, without implying that its raw bytes are archived. */
export function buildScreeningEvidenceReceipt(candidate: CandidateOpportunity) {
  return [
    "GridPulse investigation evidence receipt",
    `Candidate: ${candidate.id}`,
    `Site: ${candidate.siteName} (${candidate.siteId})`,
    `Mapped node: ${candidate.nodeName} (${candidate.nodeId})`,
    `Mapped operator: ${candidate.operator ?? "Not established"}`,
    `Source identifiers: ${candidate.provenance?.sourceIds.join(", ") || "Not recorded"}`,
    `Source publication: ${candidate.sourcePublishedAt ?? "Unknown; retrieval time is not publication time"}`,
    `Ranking method: ${candidate.calculationVersion}`,
    `Evidence method: ${candidate.provenance?.methodVersion ?? "Not recorded"}`,
    `Infrastructure class: ${candidate.infrastructureClass?.replaceAll("_", " ") ?? "Not classified"}`,
    candidate.suitabilityNote ?? "Connection role and responsibility require confirmation.",
    `Retrieval limit: ${candidate.retrievalCapped === true ? "Unresolved cap; results may be incomplete" : candidate.retrievalCapped === false ? "No unresolved cap reported; not proof of complete geographic coverage" : "Not recorded; completeness unknown"}`,
    `Retrieved-input SHA-256: ${candidate.sourceSnapshotSha256 ?? "Not recorded"}`,
    "A hash identifies the retrieved input. It does not archive that input, establish a source release or grant reuse rights.",
    "Investigation priority only. Available import/export MW, connection rights, land availability and delivery dates remain unconfirmed.",
  ].join("\n\n");
}
