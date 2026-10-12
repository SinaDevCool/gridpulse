import type { ReactNode } from "react";
import { evidenceLabels, type EvidenceClass } from "./evidence";

export function OperationsEvidenceBadge({ kind, label }: { kind: EvidenceClass; label?: string }) {
  return <span className={`operations-v2-evidence ${kind}`}>{label ?? evidenceLabels[kind]}</span>;
}

export function OperationsMetricCard({
  icon,
  label,
  value,
  note,
  evidence,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  evidence?: EvidenceClass;
  tone?: "warning" | "danger";
}) {
  return (
    <article className={`operations-v2-metric ${tone ?? ""}`}>
      <header>
        <span aria-hidden="true">{icon}</span>
        {evidence ? <OperationsEvidenceBadge kind={evidence} /> : null}
      </header>
      <p>{label}</p>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

export function OperationsDefinitionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
