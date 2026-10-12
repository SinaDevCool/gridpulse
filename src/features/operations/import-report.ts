export type OperationsImportKind = "facility" | "battery" | "scheduler" | "gpu";
export type OperationsImportReport = {
  kind: OperationsImportKind;
  filename: string;
  rowCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  importedAt: string;
  validation: "domain_validated" | "backend_input_validated";
  dispatchVerified: false;
};

/** Metadata for accepted records only; never upgrades uploaded data to verified dispatch. */
export function buildImportReport(
  kind: OperationsImportKind,
  filename: string,
  timestamps: readonly string[],
  backendValidated: boolean,
  importedAt = new Date().toISOString(),
): OperationsImportReport {
  const sorted = timestamps
    .filter((value) => Number.isFinite(Date.parse(value)))
    .slice()
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    kind,
    filename,
    rowCount: timestamps.length,
    firstTimestamp: sorted[0] ?? null,
    lastTimestamp: sorted.at(-1) ?? null,
    importedAt,
    validation: backendValidated ? "backend_input_validated" : "domain_validated",
    dispatchVerified: false,
  };
}
