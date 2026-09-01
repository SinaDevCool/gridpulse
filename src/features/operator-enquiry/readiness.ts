export type EnquiryInput = {
  site: boolean;
  requestedImport: boolean;
  loadProfile: boolean;
  targetDate: boolean;
  phasing: boolean;
  constraintExposure: boolean;
  sourceReferences: boolean;
};
const labels: Record<keyof EnquiryInput, string> = {
  site: "Site identity",
  requestedImport: "Requested import",
  loadProfile: "Load profile",
  targetDate: "Target energisation date",
  phasing: "Energisation phasing",
  constraintExposure: "Constraint-exposure result",
  sourceReferences: "Evidence source references",
};
export function enquiryReadiness(input: EnquiryInput) {
  const missing = (Object.keys(labels) as (keyof EnquiryInput)[])
    .filter((key) => !input[key])
    .map((key) => labels[key]);
  return {
    ready: missing.length === 0,
    missing,
    completed: Object.keys(labels).length - missing.length,
    total: Object.keys(labels).length,
  };
}
