import type { ReactNode } from "react";
import { formatDurationHours, formatMw } from "../formatting";
import { comparisonMaximum } from "./overview-presentation";

export type PlanComparisonRow = {
  id: string; label: string; peakMw: number; breachMinutes: number;
  outcome: ReactNode; selected?: boolean; onSelect?: () => void; tone?: "baseline" | "plan";
};
export function PlanComparison({ rows, target, limit, peakLabel, outcomeLabel, footnote }: {
  rows: PlanComparisonRow[]; target: number; limit: number; peakLabel: string; outcomeLabel: string; footnote?: ReactNode;
}) {
  const maximum = comparisonMaximum(rows.map(row => row.peakMw), target, limit);
  return <div className="ops-response-comparison">
    <p className="ops-comparison-key"><span><i className="target" aria-hidden="true" />Target {formatMw(target)}</span>
      <span><i className="limit" aria-hidden="true" />Limit {formatMw(limit)}</span><span>Shared MW scale</span></p>
    <div className="operations-scenario-table-wrap"><table className="operations-scenario-table ops-compact-comparison">
      <thead><tr><th scope="col">Response</th><th scope="col">{peakLabel}</th><th scope="col">Above facility limit</th><th scope="col">{outcomeLabel}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} data-tone={row.tone} className={row.selected ? "selected" : undefined}
        onClick={row.onSelect ? event => {
          if (event.target instanceof Element && !event.target.closest("button,a,input,select")) row.onSelect?.();
        } : undefined}>
        <th scope="row">{row.onSelect ? <button type="button" aria-label={`Select ${row.label} comparison`}
          aria-pressed={row.selected} onClick={row.onSelect}>{row.label}</button> : row.label}</th>
        <td><div className="ops-peak-comparison"><span className="ops-boundary-track" aria-hidden="true">
          <i style={{ width: `${100 * row.peakMw / maximum}%` }} />
          <b className="target" style={{ left: `${100 * target / maximum}%` }} />
          <b className="limit" style={{ left: `${100 * limit / maximum}%` }} /></span>
          <strong>{formatMw(row.peakMw)}</strong></div></td>
        <td>{formatDurationHours(row.breachMinutes / 60)}</td><td>{row.outcome}</td>
      </tr>)}</tbody>
    </table></div>{footnote ? <small>{footnote}</small> : null}
  </div>;
}
