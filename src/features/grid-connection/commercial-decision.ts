import type { DecisionMatrixRow } from "./decision-matrix";

export type CommercialDecisionInput = {
  requestedImportMw: number;
  minimumViableImportMw: number;
  preferredOption: DecisionMatrixRow | null;
  estimatedConnectionCostEur: number | null;
  indicatedConnectionDate: string | null;
  targetConnectionDate: string | null;
};

export type CommercialDecision = {
  gate: "proceed" | "conditional" | "hold";
  score: number;
  initialImportMw: number | null;
  demandCoveragePercent: number | null;
  annualExposureEur: number | null;
  connectionCostEur: number | null;
  scheduleStatus: "operator_indicated" | "customer_target_only" | "unknown";
  risks: Array<{
    key: string;
    severity: "critical" | "warning" | "info";
    label: string;
    mitigation: string;
  }>;
  nextAction: string;
  boundary: string;
};

export function assessCommercialDecision(input: CommercialDecisionInput): CommercialDecision {
  const option = input.preferredOption;
  const initialImportMw = option?.initialImportMw ?? null;
  const demandCoveragePercent =
    initialImportMw == null || input.requestedImportMw <= 0
      ? null
      : Math.round((initialImportMw / input.requestedImportMw) * 100);
  const scheduleStatus = input.indicatedConnectionDate
    ? "operator_indicated"
    : input.targetConnectionDate
      ? "customer_target_only"
      : "unknown";
  const risks: CommercialDecision["risks"] = [
    ...(!option
      ? [
          {
            key: "strategy",
            severity: "critical" as const,
            label: "No preferred connection strategy",
            mitigation: "Compare the options and record one preferred strategy with rationale.",
          },
        ]
      : []),
    ...(option && option.evidenceStatus !== "operator_supported"
      ? [
          {
            key: "operator",
            severity: "critical" as const,
            label: "Connection envelope is not operator-supported",
            mitigation: option.nextAction,
          },
        ]
      : []),
    ...(option?.annualExposureEur == null
      ? [
          {
            key: "exposure",
            severity: "warning" as const,
            label: "Curtailment exposure is not quantified",
            mitigation: "Validate an interval profile and rerun the dispatch analysis.",
          },
        ]
      : []),
    ...(input.estimatedConnectionCostEur == null
      ? [
          {
            key: "cost",
            severity: "warning" as const,
            label: "Connection capital is not operator-indicated",
            mitigation: "Request an operator cost indication and record its validity boundary.",
          },
        ]
      : []),
    ...(scheduleStatus !== "operator_indicated"
      ? [
          {
            key: "schedule",
            severity: "warning" as const,
            label:
              scheduleStatus === "customer_target_only"
                ? "Schedule is a customer target only"
                : "Connection schedule is unknown",
            mitigation: "Request a written operator milestone and indicated connection date.",
          },
        ]
      : []),
    ...(option?.operationalStatus === "fails_minimum_viable_capacity"
      ? [
          {
            key: "viability",
            severity: "critical" as const,
            label: "Option fails the minimum viable import",
            mitigation: "Revise the operating requirement or reject this option.",
          },
        ]
      : []),
  ];
  const critical = risks.filter((risk) => risk.severity === "critical").length;
  const warnings = risks.filter((risk) => risk.severity === "warning").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      (option?.evidenceReadiness ?? 0) +
        (option?.analysis ? 10 : 0) +
        (input.estimatedConnectionCostEur != null ? 10 : 0) +
        (scheduleStatus === "operator_indicated" ? 10 : 0) -
        critical * 15 -
        warnings * 5,
    ),
  );
  const gate =
    option?.operationalStatus === "fails_minimum_viable_capacity" || critical > 0
      ? score >= 45
        ? "conditional"
        : "hold"
      : score >= 75
        ? "proceed"
        : score >= 45
          ? "conditional"
          : "hold";
  return {
    gate,
    score,
    initialImportMw,
    demandCoveragePercent,
    annualExposureEur: option?.annualExposureEur ?? null,
    connectionCostEur: input.estimatedConnectionCostEur,
    scheduleStatus,
    risks,
    nextAction:
      risks[0]?.mitigation ??
      "Capture the commercial decision and advance the controlled operator package.",
    boundary:
      "Commercial decision support uses declared inputs, simulations, and recorded operator indications. Unknown costs and dates remain unknown; no connection offer or investment return is inferred.",
  };
}
