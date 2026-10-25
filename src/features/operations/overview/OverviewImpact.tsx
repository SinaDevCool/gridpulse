import { formatDurationHours, formatMw } from "../formatting";
import { BreachTrack } from "./BreachTrack";
import { peakChange, type OverviewImpact as Impact } from "./overview-presentation";

export function OverviewImpact({ impact, onSelect }: { impact: Impact; onSelect: (time: string) => void }) {
  const change = peakChange(impact.baselinePeakMw, impact.planPeakMw);
  return <div className="ops-impact-lanes" aria-label="Time above facility limit">
    <div className="ops-impact-summary"><span>{change.label}</span><strong>{formatMw(change.magnitude)}</strong>
      <small>{formatMw(impact.baselinePeakMw)} → {formatMw(impact.planPeakMw)}</small>
      <span className="ops-scope-caption">{impact.scope === "full_horizon" ? "Full-horizon peaks" : "Display-window peaks"}</span>
    </div>
    <div className="ops-impact-timelines">{impact.lanes.map(lane => <div className="ops-impact-lane" key={lane.label}>
      <span>{lane.label}<strong>{formatDurationHours(lane.minutes / 60)} above {formatMw(impact.limitMw)}</strong></span>
      <BreachTrack spans={lane.spans} first={impact.start} duration={impact.durationMs} label={lane.label} onSelect={onSelect} />
    </div>)}
      <details className="ops-result-help"><summary>Read the breach timeline</summary>
        <p>Red segments mark intervals above the facility limit; select one to inspect it. Durations use the labelled assessment scope. The two peaks may occur at different times.</p>
      </details>
    </div>
  </div>;
}
