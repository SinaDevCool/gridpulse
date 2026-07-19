import type { CandidateSite, Evidence, Scenario } from "@/lib/assessment-model";
import { germanGridEvidenceGaps, germanGridSources } from "@/lib/german-grid-sources";
import type { FlexibilityResult } from "./domain";
import type { ConnectionOptionResult } from "./connection-options";

export type OperatorPackageSnapshot = {
  generatedAt: string;
  disclaimer: string;
  project: Record<string, unknown>;
  evidenceRegister: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  modelledOptions: Array<Record<string, unknown>>;
  flexibility: FlexibilityResult;
  questionsForOperator: string[];
  methodologySources: typeof germanGridSources;
  evidenceGaps: string[];
};

export function buildOperatorPackage({
  site,
  evidence,
  scenarios,
  flexibility,
  options = [],
}: {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  flexibility: FlexibilityResult;
  options?: ConnectionOptionResult[];
}): OperatorPackageSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Customer-side planning package. It is not a connection offer, capacity confirmation or engineering approval. The responsible network operator remains controlling.",
    project: {
      id: site.id,
      name: site.name,
      projectType: site.project_type,
      location: { latitude: site.latitude, longitude: site.longitude },
      municipality: site.municipality,
      federalState: site.federal_state,
      requestedImportMw: site.requested_import_mw,
      requestedExportMw: site.requested_export_mw,
      targetVoltageKv: site.target_voltage_kv,
      targetEnergisationDate: site.target_energization_date,
      likelyOperator: site.likely_network_operator,
      operatorStatus: site.operator_confirmation_status,
    },
    evidenceRegister: evidence.map((item) => ({
      id: item.id,
      title: item.title,
      classification: item.classification,
      validationStatus: item.validation_status,
      confidence: item.confidence,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      observedAt: item.observed_at,
    })),
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      connectionMode: scenario.connection_mode,
      importLimitMw: scenario.max_import_mw,
      exportLimitMw: scenario.max_export_mw,
      status: scenario.status,
      assumptions: scenario.assumptions,
      conditionalImportMw: scenario.conditional_import_mw,
      eventualImportMw: scenario.eventual_import_mw,
      firmness: scenario.firmness,
      restrictionSchedule: scenario.restriction_schedule,
      dependencies: scenario.dependencies,
      evidenceReadiness: scenario.evidence_readiness,
      selectionStatus: scenario.selection_status,
      selectionRationale: scenario.selection_rationale,
      calculationVersion: scenario.calculation_version,
    })),
    modelledOptions: options.map((option) => ({
      kind: option.kind,
      title: option.title,
      initialImportMw: option.initialImportMw,
      eventualImportMw: option.eventualImportMw,
      evidenceStatus: option.evidenceStatus,
      operationalStatus: option.operationalStatus,
      summary: option.analysis
        ? {
            restrictedHours: option.analysis.restrictedHours,
            restrictionEvents: option.analysis.restrictionEvents,
            longestRestrictionHours: option.analysis.longestRestrictionHours,
            residualUnservedMwh: option.analysis.residualUnservedMwh,
            minimumViableBreaches: option.analysis.minimumViableBreaches,
          }
        : null,
      customerCommitments: option.customerCommitments,
      operatorQuestions: option.operatorQuestions,
      warnings: option.warnings,
    })),
    flexibility,
    questionsForOperator: [
      "Which connection point and voltage level should control the formal application?",
      "What firm import can be supported before upstream reinforcement is completed?",
      "Can a temporary or permanent flexible connection agreement be offered under §17(2b) EnWG?",
      "Which static or dynamic restriction parameters and control interface would apply?",
      "Which studies, securities, land rights and technical documents are required for reservation?",
      "Does the request enter a node-level allocation or maturity-prioritisation procedure?",
      "What reinforcement milestone changes the firm or conditional import envelope?",
    ],
    methodologySources: germanGridSources,
    evidenceGaps: germanGridEvidenceGaps,
  };
}

export function buildDecisionMemo(snapshot: OperatorPackageSnapshot) {
  const compatible = snapshot.flexibility.compatible;
  return {
    generatedAt: snapshot.generatedAt,
    project: snapshot.project,
    recommendation: compatible
      ? "Take the declared flexible envelope to the responsible operator for engineering review."
      : "Do not rely on the current flexible envelope; revise the load, storage or firm-capacity requirement.",
    status: compatible ? "requires_operator_study" : "commercially_unacceptable",
    reasons: [
      `Residual restriction shortfall: ${snapshot.flexibility.residualShortfallMw} MW.`,
      `Minimum-load compatibility: ${compatible ? "passes declared inputs" : "fails declared inputs"}.`,
      "No capacity or connection date is confirmed without written operator evidence.",
    ],
    nextActions: compatible
      ? snapshot.questionsForOperator
      : [
          "Reduce minimum critical load or increase firm capacity.",
          "Test longer restriction durations and higher event frequency.",
          "Compare an alternative site or wait-for-reinforcement scenario.",
        ],
    evidenceRegister: snapshot.evidenceRegister,
  };
}

export function downloadJson(filename: string, value: unknown) {
  const anchor = document.createElement("a");
  anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(value, null, 2))}`;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
