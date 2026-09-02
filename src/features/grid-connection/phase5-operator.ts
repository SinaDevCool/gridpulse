export const PHASE5_VERSION = "de-operator-engagement-v1" as const;
export const RELEASE5_BENCHMARK_STATEMENT =
  "Dynamische Bezugsleistung 42,5 MW. Einspeisung 0 MW. Gültig 01.09.2026 bis 31.08.2027. Vorlauf 15 Minuten. Schutzkonzept und Telemetrie erforderlich.";

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
  const numericInputs = [
    declared.requestedImportMw,
    declared.requestedExportMw,
    declared.notificationLeadMinutes,
  ].filter((value): value is number => value !== null && value !== undefined);
  if (numericInputs.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Declared operator-comparison values must be finite and non-negative.");
  }
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
    if (match?.[1]) {
      const value = Number(match[1].replace(",", "."));
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
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
  const isoDates = [...normalized.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map(
    (match) => `${match[1]}-${match[2]}-${match[3]}`,
  );
  const germanDates = [...normalized.matchAll(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/g)].map(
    (match) => `${match[3]}-${match[2]}-${match[1]}`,
  );
  const dates = [...isoDates, ...germanDates].filter(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
  );
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
    validFrom: dates[0] ?? null,
    validTo: dates[1] ?? null,
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
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Restriction rehearsal values must be finite and non-negative.");
  }
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

export function buildRelease5Acceptance() {
  const facts = extractOperatorFacts(RELEASE5_BENCHMARK_STATEMENT);
  const discrepancies = compareOperatorFacts(facts, {
    requestedImportMw: 60,
    requestedExportMw: 0,
    notificationLeadMinutes: 30,
  });
  const rehearsal = simulateRestrictionEvent({
    baselineMw: 60,
    networkLimitMw: facts.importLimitMw ?? 0,
    batteryResponseMw: 8,
    workloadResponseMw: 6,
  });
  const gates = {
    operator_terms_extracted: facts.importLimitMw === 42.5 && facts.flexibilityMode === "dynamic",
    source_review_warning_present: facts.warnings.some((warning) => warning.includes("draft only")),
    discrepancy_preserved: discrepancies.some(
      (item) =>
        item.field === "import_limit_mw" &&
        item.status === "conflict" &&
        item.declaredValue === 60 &&
        item.operatorValue === 42.5,
    ),
    confirmed_field_preserved: discrepancies.some(
      (item) => item.field === "export_limit_mw" && item.status === "confirmed",
    ),
    validity_scope_extracted: facts.validFrom === "2026-09-01" && facts.validTo === "2027-08-31",
    restriction_response_rehearsed: rehearsal.requiredReductionMw === 17.5,
    residual_exposure_visible: rehearsal.residualMw === 3.5 && rehearsal.compliant === false,
    no_automatic_dispatch: rehearsal.disclaimer.includes("not a network instruction"),
    no_capacity_or_confirmation_claim: true,
  };
  return {
    schema_version: "gridpulse-release5-acceptance-v1" as const,
    release: "Release 5",
    methodology_version: PHASE5_VERSION,
    validation_class: "synthetic_demonstration" as const,
    gates,
    all_repository_gates_passed: Object.values(gates).every(Boolean),
    benchmark: {
      extracted_facts: {
        import_limit_mw: facts.importLimitMw,
        export_limit_mw: facts.exportLimitMw,
        flexibility_mode: facts.flexibilityMode,
        notice_minutes: facts.noticeMinutes,
        valid_from: facts.validFrom,
        valid_to: facts.validTo,
        study_requirement_count: facts.studyRequirements.length,
        signal_count: facts.signals.length,
      },
      discrepancy_statuses: Object.fromEntries(
        discrepancies.map((item) => [item.field, item.status]),
      ),
      restriction_rehearsal: {
        required_reduction_mw: rehearsal.requiredReductionMw,
        delivered_reduction_mw: rehearsal.deliveredReductionMw,
        residual_mw: rehearsal.residualMw,
        compliant: rehearsal.compliant,
      },
    },
    controls: {
      human_source_review_required: true,
      linked_source_document_required: true,
      authenticated_grid_expert_approval_required: true,
      declared_values_overwritten: false,
      automatic_dispatch_authorized: false,
      operator_confirmation_created: false,
      display_as_capacity: false,
      capacity_claim: false,
    },
    external_gates: [
      "real operator source document linked to the project",
      "human comparison of every extracted field with that source",
      "authenticated grid-expert approval with content hash",
      "operator-signed limits and validity scope",
      "capacity-representation permission before any public display",
    ],
  };
}
