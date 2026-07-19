import type { EvidenceClass } from "./domain";

export const PRODUCT_SCOPE_NOTICE =
  "GridPulse provides customer-side screening and decision support. It is not a network study, connection offer, capacity reservation, or operator approval.";

export const CAPACITY_NOTICE =
  "Requested or modelled power is not available grid capacity. Capacity, connection point, operating limits, and energisation date require written confirmation from the responsible network operator.";

export const evidenceClassDescription: Record<EvidenceClass, string> = {
  customer_declared: "Information supplied by the project team; not independently verified.",
  public_source: "Published context; not project-specific capacity evidence.",
  derived: "A GridPulse calculation or screening result based on stated inputs and assumptions.",
  operator_confirmed:
    "Current written project-specific evidence from the responsible network operator.",
};

export function isCapacityClaimAllowed(evidenceClass: EvidenceClass, validated: boolean) {
  return evidenceClass === "operator_confirmed" && validated;
}
