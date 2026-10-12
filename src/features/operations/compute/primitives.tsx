import { type ReactNode } from "react";

import type { EvidenceClass } from "../evidence";

import { OperationsMetricCard } from "../components";

import { type ComputeWorkload } from "../workload-intelligence";

export function Metric({
  icon,
  label,
  value,
  evidence,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  evidence: EvidenceClass;
  note: string;
  tone?: "warning" | "danger";
}) {
  return (
    <OperationsMetricCard
      icon={icon}
      label={label}
      value={value}
      evidence={evidence}
      note={note}
      tone={tone}
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

export function Status({ value }: { value: ComputeWorkload["status"] }) {
  return <span className={`compute-status ${value}`}>{value}</span>;
}
