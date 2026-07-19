import type { EvidenceClass, Provenance, ValidationStatus } from "./domain";

export const evidenceClassLabel: Record<EvidenceClass, string> = {
  customer_declared: "Customer declared",
  public_source: "Public source",
  derived: "Derived",
  operator_confirmed: "Operator confirmed",
};

export function isCurrent(provenance: Provenance, now = new Date()) {
  return !provenance.expiresAt || new Date(provenance.expiresAt) > now;
}

export function claimCanBeConfirmed(provenance: Provenance) {
  return (
    provenance.evidenceClass === "operator_confirmed" &&
    provenance.confidence === "confirmed" &&
    provenance.validationStatus === "validated" &&
    isCurrent(provenance)
  );
}

export function evidenceReadiness(items: Provenance[]) {
  const accepted: ValidationStatus[] = ["collected", "validated"];
  const customer = items.some(
    (item) =>
      item.evidenceClass === "customer_declared" && accepted.includes(item.validationStatus),
  );
  const publicContext = items.some(
    (item) => item.evidenceClass === "public_source" && accepted.includes(item.validationStatus),
  );
  const operator = items.some(claimCanBeConfirmed);
  const rejected = items.filter((item) => ["rejected", "expired"].includes(item.validationStatus));
  return {
    customer,
    publicContext,
    operator,
    readyForScreening: customer && publicContext && rejected.length === 0,
    readyForDecision: customer && publicContext && operator && rejected.length === 0,
    rejectedCount: rejected.length,
  };
}
