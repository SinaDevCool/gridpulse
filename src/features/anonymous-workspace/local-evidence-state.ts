import type { LocalCapacityEvidence } from "./schema";

export type LocalCapacityState = "unknown" | "validated" | "stale";

export function localEvidenceExpired(evidence: LocalCapacityEvidence | null, now = new Date()) {
  return Boolean(
    evidence?.validTo &&
    Number.isFinite(Date.parse(evidence.validTo)) &&
    Date.parse(evidence.validTo) < now.getTime(),
  );
}

export function isAcceptedLocalCapacityEvidence(
  evidence: LocalCapacityEvidence | null,
  now = new Date(),
) {
  return Boolean(
    evidence &&
    ["calculated", "validated"].includes(evidence.status) &&
    evidence.validationStatus === "validated" &&
    !localEvidenceExpired(evidence, now),
  );
}

export function localCapacityState(
  evidence: LocalCapacityEvidence | null,
  now = new Date(),
): LocalCapacityState {
  if (isAcceptedLocalCapacityEvidence(evidence, now)) return "validated";
  if (
    evidence &&
    (evidence.status === "stale" ||
      evidence.validationStatus === "expired" ||
      localEvidenceExpired(evidence, now))
  )
    return "stale";
  return "unknown";
}

export function localEvidenceGaps(evidence: LocalCapacityEvidence | null, now = new Date()) {
  if (!evidence) return ["No accepted capacity evidence is attached"];
  const gaps = evidence.unresolvedEvidence
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter(Boolean);
  if (localEvidenceExpired(evidence, now))
    gaps.unshift("Capacity evidence is past its validity date");
  if (evidence.validationStatus !== "validated")
    gaps.unshift("Capacity evidence has not been validated");
  return Array.from(new Set(gaps));
}
