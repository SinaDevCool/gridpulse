export type ValidationClass =
  | "public_screening"
  | "synthetic_demonstration"
  | "operator_model_unvalidated"
  | "operator_model_reconciled"
  | "operator_reviewed"
  | "operator_confirmed";

export const validationClassLabels: Record<ValidationClass, string> = {
  public_screening: "Public screening",
  synthetic_demonstration: "Synthetic demonstration",
  operator_model_unvalidated: "Operator model — unvalidated",
  operator_model_reconciled: "Operator model — reconciled",
  operator_reviewed: "Operator reviewed",
  operator_confirmed: "Operator confirmed",
};

export function validationClassLabel(value?: string | null) {
  return value && value in validationClassLabels
    ? validationClassLabels[value as ValidationClass]
    : "Validation class unavailable";
}
