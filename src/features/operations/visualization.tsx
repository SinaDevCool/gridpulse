import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

export type ChartVisibility = {
  visible: (id: string) => boolean;
  toggle: (id: string) => void;
  reset: () => void;
};
export function useChartVisibility(): ChartVisibility {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  return {
    visible: (id: string) => !hidden.has(id),
    toggle: (id: string) =>
      setHidden((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    reset: () => setHidden(new Set()),
  };
}

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
  id?: string;
  label: string;
  detail?: string;
  tone: OperationsSeriesTone;
  mark?: "line" | "dash" | "bar" | "area";
};

export function OperationsChartLegend({
  items,
  label = "Chart legend",
  visibility,
}: {
  items: OperationsLegendItem[];
  label?: string;
  visibility?: ChartVisibility;
}) {
  return (
    <ul className="operations-chart-legend" aria-label={label}>
      {items.map((item) => (
        <li key={`${item.label}-${item.tone}`}>
          <button
            type="button"
            disabled={!visibility}
            aria-pressed={visibility?.visible(item.id ?? item.label) ?? true}
            onClick={() => visibility?.toggle(item.id ?? item.label)}
          >
            <i
              aria-hidden="true"
              className={`operations-chart-mark ${item.tone} ${item.mark ?? "line"}`}
            />
            <span>
              <strong>{item.label}</strong>
              {item.detail ? <small>{item.detail}</small> : null}
            </span>
          </button>
        </li>
      ))}
      {visibility ? (
        <li>
          <button type="button" onClick={visibility.reset}>
            Reset chart
          </button>
        </li>
      ) : null}
      {visibility && items.every((item) => !visibility.visible(item.id ?? item.label)) ? (
        <li role="status">
          All chart layers hidden. Reset chart to restore them. Calculated results are unchanged.
        </li>
      ) : null}
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
