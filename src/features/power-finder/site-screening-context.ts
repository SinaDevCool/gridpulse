import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProjectType } from "./finder-project";
import { canonicalOperatorName } from "./operator-normalization";
import type { GridOperatorOption } from "./operator-catalog";

export type ScreeningVoltageKv = 20 | 110 | 220 | 380;

/**
 * Returns a screening voltage floor for discovery, never a connection requirement.
 * An explicit project preference remains authoritative; otherwise the bands keep
 * large-load searches broad enough to include plausible mapped connection context.
 */
export function suggestScreeningVoltage(
  requiredImportMw: number,
  _projectType: FinderProjectType,
  explicitPreference?: number | null,
): ScreeningVoltageKv {
  if ([20, 110, 220, 380].includes(explicitPreference ?? 0)) {
    return explicitPreference as ScreeningVoltageKv;
  }
  if (requiredImportMw <= 30) return 20;
  if (requiredImportMw <= 150) return 110;
  if (requiredImportMw <= 300) return 220;
  return 380;
}

export type OperatorFilterSuggestion = {
  tso?: string;
  dso?: string;
  basis: "candidate_tso" | "candidate_dso" | "unresolved";
};

/**
 * Converts the highest-ranked mapped candidate's operator into Finder filters.
 * A TSO is only inferred for a DSO when the accepted catalog has one unambiguous
 * mapped transmission relationship.
 */
export function suggestOperatorFilters(
  candidate: CandidateOpportunity | null | undefined,
  catalog: GridOperatorOption[],
): OperatorFilterSuggestion {
  const operatorName = canonicalOperatorName(candidate?.operator);
  if (!operatorName) return { basis: "unresolved" };
  const operator = catalog.find((item) => item.name === operatorName);
  if (!operator) return { basis: "unresolved" };
  if (operator.type === "TSO") return { tso: operator.name, basis: "candidate_tso" };
  return {
    dso: operator.name,
    tso: operator.tsoNames.length === 1 ? operator.tsoNames[0] : undefined,
    basis: "candidate_dso",
  };
}
