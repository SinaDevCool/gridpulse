import { describe, expect, it } from "vitest";
import { pilotOutcomeSummary, pilotReadiness, type PilotMeasurement } from "./pilot-measurement";

describe("design-partner pilot measurement", () => {
  it("computes reductions only from baseline to final", () => {
    const rows: PilotMeasurement[] = [
      {
        stage: "baseline",
        preparation_hours: 40,
        clarification_rounds_count: 5,
        evidence_gaps_count: 2,
        customer_hours_saved: null,
        rework_hours_avoided: null,
        operator_validated_mw: null,
        customer_confirmed: false,
        operator_feedback_received: false,
      },
      {
        stage: "final",
        preparation_hours: 22,
        clarification_rounds_count: 3,
        evidence_gaps_count: 7,
        customer_hours_saved: 18,
        rework_hours_avoided: 10,
        operator_validated_mw: 35,
        customer_confirmed: true,
        operator_feedback_received: true,
      },
    ];
    expect(pilotOutcomeSummary(rows)).toMatchObject({
      preparationHoursReduced: 18,
      clarificationRoundsReduced: 2,
      publishable: true,
      operatorValidated: true,
    });
  });

  it("does not treat an unconfirmed final snapshot as publishable", () => {
    expect(
      pilotOutcomeSummary([
        {
          stage: "final",
          preparation_hours: null,
          clarification_rounds_count: null,
          evidence_gaps_count: null,
          customer_hours_saved: null,
          rework_hours_avoided: null,
          operator_validated_mw: null,
          customer_confirmed: false,
          operator_feedback_received: false,
        },
      ]).publishable,
    ).toBe(false);
  });

  it("requires a real case, power floor and measurable definition", () => {
    const checks = pilotReadiness({
      organization: "Example GmbH",
      decisionOwner: "A. Owner",
      location: "Frankfurt",
      requestedImportMw: 60,
      minimumViableImportMw: 30,
      objective: "Reduce preparation rework",
      successDefinition: "Customer confirms hours saved",
    });
    expect(checks.every((check) => check.complete)).toBe(true);
  });
});
