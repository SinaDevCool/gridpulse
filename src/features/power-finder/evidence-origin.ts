export const EVIDENCE_ORIGINS = [
  "official_open",
  "open_benchmark",
  "operator_supplied",
  "customer_declared",
  "synthetic_fixture",
  "derived",
] as const;

export type EvidenceOrigin = (typeof EVIDENCE_ORIGINS)[number];

export type EvidenceBoundary = {
  origin: EvidenceOrigin;
  isSynthetic: boolean;
  validationClass: string;
  capacityClaim: boolean;
  operatorConfirmed: boolean;
  displayAsCapacity: boolean;
};

export function assertEvidenceBoundary(value: EvidenceBoundary): EvidenceBoundary {
  if (value.isSynthetic !== (value.origin === "synthetic_fixture")) {
    throw new Error("Synthetic flag must match the evidence origin.");
  }
  if (value.isSynthetic && (value.capacityClaim || value.operatorConfirmed || value.displayAsCapacity)) {
    throw new Error("Synthetic evidence cannot be represented as capacity.");
  }
  if (value.operatorConfirmed && value.validationClass !== "operator_confirmed") {
    throw new Error("Operator confirmation requires signed operator-confirmed validation.");
  }
  return value;
}
