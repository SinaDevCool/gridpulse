import type { CSSProperties, ReactNode } from "react";

export type OperationsSeriesTone =
  | "demand"
  | "response"
  | "compute"
  | "battery"
  | "soc"
  | "limit"
  | "target"
  | "neutral"
  | "positive";

export type OperationsLegendItem = {
  label: string;
  detail?: string;
  tone: OperationsSeriesTone;
  mark?: "line" | "dash" | "bar" | "area";
};

export function OperationsChartLegend({
  items,
  label = "Chart legend",
}: {
  items: OperationsLegendItem[];
  label?: string;
}) {
  return (
    <ul className="operations-chart-legend" aria-label={label}>
      {items.map((item) => (
        <li key={`${item.label}-${item.tone}`}>
          <i
            aria-hidden="true"
            className={`operations-chart-mark ${item.tone} ${item.mark ?? "line"}`}
          />
          <span>
            <strong>{item.label}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OperationsChartSummary({ children }: { children: ReactNode }) {
  return <div className="operations-chart-summary">{children}</div>;
}

export function ChartSummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: OperationsSeriesTone;
}) {
  return (
    <div className={tone ? `tone-${tone}` : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function OperationsTooltipShell({
  label,
  children,
  status,
}: {
  label?: string;
  children: ReactNode;
  status?: string;
}) {
  return (
    <div className="operations-v2-tooltip" role="status" aria-live="polite">
      <strong>{label ?? "Selected interval"}</strong>
      <div>{children}</div>
      {status ? <em>{status}</em> : null}
    </div>
  );
}

export function TooltipRow({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: OperationsSeriesTone;
  detail?: string;
}) {
  return (
    <span className="operations-tooltip-row">
      <i
        aria-hidden="true"
        className={`operations-chart-mark ${tone} line`}
        style={{ "--series": `var(--ops-${tone})` } as CSSProperties}
      />
      <span>
        <small>{label}</small>
        {detail ? <em>{detail}</em> : null}
      </span>
      <strong>{value}</strong>
    </span>
  );
}

export const formatMw = (value: number) => `${formatDecimal(value)}\u00a0MW`;
export const formatMwh = (value: number) => `${formatDecimal(value)}\u00a0MWh`;
export const formatPercent = (value: number) => `${formatDecimal(value)}%`;
export const formatGpuCount = (value: number) =>
  `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} GPU${value === 1 ? "" : "s"}`;

export function formatDurationFromIntervals(intervals: number, minutes = 15) {
  const total = Math.max(0, intervals * minutes);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder}\u00a0min`;
  if (!remainder) return `${hours}\u00a0h`;
  return `${hours}\u00a0h ${remainder}\u00a0min`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}
