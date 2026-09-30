export type EvidenceClass =
  | "measured"
  | "public_trace"
  | "user_assumption"
  | "reference"
  | "simulated"
  | "unavailable";

export type EvidenceQuality = "accepted" | "suspect" | "missing";

export type EvidencedValue<T> = {
  value: T | null;
  unit?: string;
  evidenceClass: EvidenceClass;
  sourceLabel: string;
  observedAt?: string;
  calculatedAt?: string;
  quality: EvidenceQuality;
};

export const evidenceLabels: Record<EvidenceClass, string> = {
  measured: "Measured",
  public_trace: "Public Trace",
  user_assumption: "User Assumption",
  reference: "Reference",
  simulated: "Simulated",
  unavailable: "Unavailable",
};

