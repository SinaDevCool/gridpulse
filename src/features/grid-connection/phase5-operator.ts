export const PHASE5_VERSION = "de-operator-engagement-v1" as const;

export type ExtractedOperatorFacts = {
  importLimitMw: number | null;
  exportLimitMw: number | null;
  validFrom: string | null;
  validTo: string | null;
  flexibilityMode: "static" | "scheduled" | "dynamic" | "unspecified";
  noticeMinutes: number | null;
  studyRequirements: string[];
  signals: string[];
  warnings: string[];
};

export type OperatorDiscrepancy = {
  field: "import_limit_mw" | "export_limit_mw" | "notification_lead_minutes";
  declaredValue: number | null;
  operatorValue: number | null;
  status: "confirmed" | "conflict" | "missing_operator_evidence";
  action: string;
};

export function compareOperatorFacts(
  facts: ExtractedOperatorFacts,
  declared: {
    requestedImportMw: number;
    requestedExportMw: number;
    notificationLeadMinutes?: number | null;
  },
): OperatorDiscrepancy[] {
  const compare = (
    field: OperatorDiscrepancy["field"],
    declaredValue: number | null,
    operatorValue: number | null,
  ): OperatorDiscrepancy => ({
    field,
    declaredValue,
    operatorValue,
    status:
      operatorValue === null
        ? "missing_operator_evidence"
        : declaredValue === operatorValue
          ? "confirmed"
          : "conflict",
    action:
      operatorValue === null
        ? "Ask the operator to state this value explicitly."
        : declaredValue === operatorValue
          ? "Retain both the declaration and reviewed source reference."
          : "Resolve the difference with a reviewer; do not overwrite either value.",
  });
  return [
    compare("import_limit_mw", declared.requestedImportMw, facts.importLimitMw),
    compare("export_limit_mw", declared.requestedExportMw, facts.exportLimitMw),
    compare(
      "notification_lead_minutes",
      declared.notificationLeadMinutes ?? null,
      facts.noticeMinutes,
    ),
  ];
}

const firstNumber = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1].replace(",", "."));
  }
  return null;
};

export function extractOperatorFacts(text: string): ExtractedOperatorFacts {
  const normalized = text.replace(/\s+/g, " ").trim();
  const importLimitMw = firstNumber(normalized, [
    /(?:import|bezug|bezugsleistung|max(?:imum)? import)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*mw/i,
    /(\d+(?:[.,]\d+)?)\s*mw[^.]{0,35}(?:import|bezug)/i,
  ]);
  const exportLimitMw = firstNumber(normalized, [
    /(?:export|einspeisung|max(?:imum)? export)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*mw/i,
    /(\d+(?:[.,]\d+)?)\s*mw[^.]{0,35}(?:export|einspeisung)/i,
  ]);
  const noticeMinutes = firstNumber(normalized, [
    /(?:notice|vorlauf|ankündigung)[^\d]{0,20}(\d+)\s*(?:minutes|minuten|min)/i,
  ]);
  const flexibilityMode = /dynamic|dynamisch|real[- ]?time|echtzeit/i.test(normalized)
    ? "dynamic"
    : /schedule|scheduled|zeitfenster|fahrplan/i.test(normalized)
      ? "scheduled"
      : /static|statisch|fixed limit|feste grenze/i.test(normalized)
        ? "static"
        : "unspecified";
  const studyRequirements = [
    /short[- ]?circuit|kurzschluss/i.test(normalized) ? "Short-circuit study" : null,
    /protection|schutzkonzept/i.test(normalized) ? "Protection coordination" : null,
    /power quality|netzrückwirkung/i.test(normalized) ? "Power-quality study" : null,
    /interaction study|interaktionsstudie|model(?:ling)?/i.test(normalized)
      ? "Detailed interaction/model study"
      : null,
  ].filter((item): item is string => Boolean(item));
  const signals = [
    /api|schnittstelle/i.test(normalized) ? "Digital interface mentioned" : null,
    /meter|messung|telemetry|telemetrie/i.test(normalized) ? "Metering/telemetry mentioned" : null,
    /fail[- ]?safe|rückfallwert/i.test(normalized) ? "Fail-safe behaviour mentioned" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    importLimitMw,
    exportLimitMw,
    validFrom: null,
    validTo: null,
    flexibilityMode,
    noticeMinutes,
    studyRequirements,
    signals,
    warnings: [
      "Machine-highlighted draft only. Compare every field with the source document.",
      importLimitMw === null ? "No explicit import limit was identified." : null,
      flexibilityMode === "unspecified" ? "No flexibility mode was identified." : null,
    ].filter((item): item is string => Boolean(item)),
  };
}

export function simulateRestrictionEvent(input: {
  baselineMw: number;
  networkLimitMw: number;
  batteryResponseMw: number;
  workloadResponseMw: number;
}) {
  const requiredReductionMw = Math.max(0, input.baselineMw - input.networkLimitMw);
  const deliveredReductionMw = Math.min(
    requiredReductionMw,
    Math.max(0, input.batteryResponseMw) + Math.max(0, input.workloadResponseMw),
  );
  const residualMw = Math.max(0, requiredReductionMw - deliveredReductionMw);
  return {
    ...input,
    requiredReductionMw,
    deliveredReductionMw,
    residualMw,
    compliant: residualMw === 0,
    disclaimer: "Simulation—not a network instruction or proof of connection capacity.",
  };
}
