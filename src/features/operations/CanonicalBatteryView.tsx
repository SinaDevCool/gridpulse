import type { CanonicalInspectionProps } from "./canonical-view-props";
import { selectCanonicalBatteryView } from "./canonical-battery-view";
import { CanonicalBatteryInspector } from "./CanonicalBatteryInspector";
import { CanonicalBatteryDetails } from "./CanonicalBatteryDetails";
import { CanonicalResultDetails } from "./CanonicalResultDetails";
import { BatteryWorkspaceHeading } from "./power/BatteryWorkspaceHeading";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { IntervalNavigation } from "./inspection";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";

export function CanonicalBatteryView({ assessment: a, timestamp, preview, onSelect, onPreview }: CanonicalInspectionProps) {
  const inspected = preview ?? timestamp;
  const m = selectCanonicalBatteryView(a, inspected);
  const p = m.selected;
  return <section className="operations-v2-view power-battery battery-workspace ops-canonical ops-canonical--battery"
    data-assessment-id={a.projected.identity.resultFingerprint} data-inspected-time={p.timestamp}>
    <h2 className="sr-only">Joint-plan battery response</h2>
    <div className="battery-workspace-grid"><article className="power-timeline-card">
      <BatteryWorkspaceHeading badge={<span className="ops-review-state">MILP · synthetic model</span>} />
      <IntervalNavigation points={a.points} timestamp={timestamp} onSelect={onSelect} peak={m.peak} peakLabel="Inspect plan peak" />
      <div className="power-horizon-status" aria-label="Full-horizon battery assessment">
        <span>Full horizon · joint plan</span><strong data-tone={m.targetMet ? "positive" : "warning"}>{m.targetMet ? "Target met" : "Target unmet"}</strong>
        <strong data-tone={m.reserveProtected === false ? "warning" : "positive"}>{m.reserveProtected === null ? "No battery" : m.reserveProtected ? "Reserve protected" : "Reserve unresolved"}</strong>
        {m.audit ? <strong data-tone={m.facts.terminalTargetsMet === true ? "positive" : "warning"}>{m.facts.terminalTargetsMet === true ? "Terminal target met" : m.facts.terminalTargetsMet === null ? "Terminal check unavailable" : "Terminal target unresolved"}</strong> : null}
        <span>Read-only · no equipment commands</span>
      </div>
      <section className="ops-battery-interval" aria-label="Selected interval power facts" aria-live="polite">
        <p className="context-label">{formatOperationsTime(p.timestamp)} · selected interval</p>
        <dl className="ops-compact-facts">
          <div><dt>Planned demand · before battery</dt><dd>{formatMw(p.facilityDemandMw!)}</dd></div>
          <div><dt>Battery · {m.direction.toLowerCase()}</dt><dd>{a.batteryAudit ? formatMw(p.batteryPowerMw!) : "Not applicable"}</dd></div>
          <div><dt>Grid import</dt><dd>{formatMw(p.gridImportMw)}</dd></div>
          <div><dt>Safety-target margin</dt><dd>{formatMw(m.margins.safety)}</dd></div>
        </dl>
      </section>
      <PowerTimeline data={a.points} limitMw={a.limitMw} targetMw={a.targetMw} protectedSocPercent={a.protectedSocPercent}
        maximumSocPercent={a.batteryAudit?.maximumSocPercent} selectedTimestamp={inspected} onSelect={onSelect}
        mode="scenario" previewing={preview !== null} variant={a.batteryAudit ? "battery" : "overview"}
        showConstraints={false} batteryBoundaryStates={!!a.batteryAudit} />
      <details className="ops-plan-conditions"><summary>Inspect plan conditions</summary>
        <p>Returned dispatch and target checks—not causal binding constraints.</p>
        <div className="battery-state-band" role="img" aria-label={m.segments.map(segment => `${segment.label}: ${segment.minutes} min`).join("; ")}>
          {m.segments.map(segment => <span key={segment.start} data-state={segment.code} title={segment.label}
            style={{ flexGrow: segment.minutes, background: segment.code.includes("Above") ? "var(--ops-target)" : segment.code.startsWith("Charging") ? "var(--ops-demand)" : segment.code.startsWith("Discharging") ? "var(--ops-response)" : "var(--ops-border)" }} />)}
        </div><label>Inspect condition period<select value={m.segments.find(segment => p.timestamp >= segment.start && p.timestamp < segment.end!)?.start ?? m.segments[0].start}
          onChange={event => onSelect(event.target.value)}>{m.segments.map(segment => <option key={segment.start} value={segment.start}>
            {segment.label} · {formatOperationsTime(segment.start)} · {segment.minutes} min</option>)}</select></label>
      </details>
      <div className="battery-events" aria-label="Key battery events"><span>Returned plan events · full horizon</span>
        {m.events.map(event => <button type="button" key={event.label} aria-pressed={event.point!.timestamp === p.timestamp}
          onClick={() => onSelect(event.point!.timestamp)}>{event.label}<strong>{formatOperationsTime(event.point!.timestamp)}</strong></button>)}
      </div>
    </article><CanonicalBatteryInspector model={m} /></div>
    <div className="battery-inspection-actions">
      <PowerDataTable data={a.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp} onSelect={onSelect} onPreview={onPreview} mode="scenario" context="battery" />
      <CanonicalBatteryDetails assessment={a} model={m} />
      <CanonicalResultDetails assessment={a} includeGuidance />
    </div>
  </section>;
}
