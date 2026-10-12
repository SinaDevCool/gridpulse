export type CalculationClass = "observed" | "derived" | "heuristic" | "synthetic";

export type CalculationProvenance = {
  calculationClass: CalculationClass;
  evidenceStatus: "source_attached" | "source_inferred" | "method_derived" | "synthetic_fixture";
  methodVersion: string;
  sourceIds: string[];
  calculatedAt: string | null;
  limitations: string[];
};

export const calculationClassLabels: Record<CalculationClass, string> = {
  observed: "Source evidence",
  derived: "Derived from mapped evidence",
  heuristic: "GridPulse screening rule",
  synthetic: "Experimental demonstration",
};

export const PUBLIC_SCREENING_METHOD_VERSION = "evidence-investigation-priority-v2";

export function publicScreeningProvenance(sourceIds: string[]): CalculationProvenance {
  return {
    calculationClass: "heuristic",
    evidenceStatus: "method_derived",
    methodVersion: PUBLIC_SCREENING_METHOD_VERSION,
    sourceIds,
    calculatedAt: null,
    limitations: [
      "Prioritises public-source investigation only.",
      "Does not establish capacity, compatibility, feasibility, probability, cost or timing.",
    ],
  };
}
