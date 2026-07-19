export type PilotMeasurement = {
  stage: "baseline" | "interim" | "final";
  preparation_hours: number | null;
  clarification_rounds_count: number | null;
  evidence_gaps_count: number | null;
  customer_hours_saved: number | null;
  rework_hours_avoided: number | null;
  operator_validated_mw: number | null;
  customer_confirmed: boolean;
  operator_feedback_received: boolean | null;
};

export function pilotOutcomeSummary(rows: PilotMeasurement[]) {
  const baseline = rows.find((row) => row.stage === "baseline") ?? null;
  const final = [...rows].reverse().find((row) => row.stage === "final") ?? null;
  const delta = (key: "preparation_hours" | "clarification_rounds_count") =>
    baseline?.[key] != null && final?.[key] != null ? baseline[key]! - final[key]! : null;
  return {
    baseline,
    final,
    preparationHoursReduced: delta("preparation_hours"),
    clarificationRoundsReduced: delta("clarification_rounds_count"),
    publishable: Boolean(final?.customer_confirmed),
    operatorValidated: Boolean(
      final?.operator_feedback_received && final.operator_validated_mw != null,
    ),
  };
}

export function pilotReadiness(input: {
  organization: string;
  decisionOwner: string;
  location: string;
  requestedImportMw: number;
  minimumViableImportMw: number | null;
  objective: string;
  successDefinition: string;
}) {
  return [
    {
      key: "owner",
      label: "Named customer decision owner",
      complete: Boolean(input.organization && input.decisionOwner),
    },
    { key: "location", label: "Real German project location", complete: Boolean(input.location) },
    {
      key: "power",
      label: "Requested and minimum viable import",
      complete:
        input.requestedImportMw > 0 &&
        input.minimumViableImportMw != null &&
        input.minimumViableImportMw <= input.requestedImportMw,
    },
    {
      key: "success",
      label: "Pilot objective and measurable success definition",
      complete: Boolean(input.objective && input.successDefinition),
    },
  ];
}
