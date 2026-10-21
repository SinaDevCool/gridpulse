import { Database } from "lucide-react";

import { OperationsEvidenceBadge } from "../components";

import { type EvidenceMode } from "./presentation";

export function EvidencePill({ mode }: { mode: EvidenceMode | "assumption" }) {
  const kind =
    mode === "historical" ? "measured" : mode === "scenario" ? "simulated" : "user_assumption";
  return (
    <OperationsEvidenceBadge
      kind={kind}
      label={mode === "historical" ? "Measured" : mode === "scenario" ? "Simulated" : "Assumption"}
    />
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function EmptyEvidence() {
  return (
    <div className="power-empty">
      <Database aria-hidden="true" />
      <strong>No accepted records</strong>
      <span>
        Import the required real measurements; missing values are not synthetically filled.
      </span>
    </div>
  );
}
