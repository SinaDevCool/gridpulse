import type { ConstraintExposure } from "./contracts";

const severityOrder = { low: 0, moderate: 1, high: 2, critical: 3, unknown: 4 } as const;

export function orderedMitigations(result: ConstraintExposure) {
  return [...result.mitigations].sort(
    (a, b) =>
      severityOrder[a.residualSeverity] - severityOrder[b.residualSeverity] ||
      a.requestedImportMw - b.requestedImportMw ||
      a.id.localeCompare(b.id),
  );
}
