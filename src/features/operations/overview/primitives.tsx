import { type ReactNode } from "react";

import { type EvidencedValue } from "../evidence";

import { OperationsMetricCard } from "../components";

import { integer,number } from "./presentation";

export function MetricCard<T>({
  icon,
  label,
  metric,
  note,
  tone,
  format,
}: {
  icon: ReactNode;
  label: string;
  metric: EvidencedValue<T>;
  note: string;
  tone?: "warning" | "danger";
  format?: "integer";
}) {
  const value =
    metric.value == null
      ? "Unavailable"
      : typeof metric.value === "number"
        ? format === "integer"
          ? integer.format(metric.value)
          : number.format(metric.value)
        : String(metric.value);
  return (
    <OperationsMetricCard
      icon={icon}
      label={label}
      evidence={metric.evidenceClass}
      tone={tone}
      value={
        <>
          {value}
          {metric.value != null && metric.unit ? <small>&nbsp;{metric.unit}</small> : null}
          {label === "Additional GPUs Supportable" && metric.value != null ? (
            <small>&nbsp;GPU{Number(metric.value) === 1 ? "" : "s"}</small>
          ) : null}
        </>
      }
      note={note}
    />
  );
}

export function ChartHeader({
  eyebrow,
  title,
  badge,
}: {
  eyebrow: string;
  title: string;
  badge: string;
}) {
  return (
    <header className="operations-v2-chart-header">
      <div>
        <p className="context-label">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <span>{badge}</span>
    </header>
  );
}

export function ImpactRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
