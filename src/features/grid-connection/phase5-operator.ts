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
