import { useState } from "react";
import type { CanonicalInspectionProps } from "./canonical-view-props";
import { CanonicalOperatingSummary, CanonicalOverviewDetails } from "./CanonicalOverviewDetails";
import { CanonicalResultDetails } from "./CanonicalResultDetails";
import { canonicalImpact } from "./canonical-overview";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { ChartHeader } from "./overview/primitives";
import { OverviewImpact } from "./overview/OverviewImpact";
import { InspectionRange } from "./overview/InspectionRange";
import { IntervalNavigation } from "./inspection";
import { formatOperationsTime } from "./presentation";
import { formatMw } from "./formatting";

/** Overview composition only. Parent-owned canonical time/preview still links all three tabs. */
export function CanonicalOverviewView({ assessment: a, timestamp, preview, onSelect, onPreview }: CanonicalInspectionProps) {
  const identity = a.projected.identity.resultFingerprint;
  const [range, setRange] = useState<{ identity: string; startIndex: number; endIndex: number } | null>(null);
  const currentRange = range?.identity === identity ? range : null;
  const displayed = currentRange ? a.points.slice(currentRange.startIndex, currentRange.endIndex + 1) : a.points;
  const inspected = preview ?? timestamp;
  const index = Math.max(0, a.points.findIndex(point => point.timestamp === inspected));
  const selected = a.points[index];
  const peak = a.points.reduce((best, point) => point.gridImportMw > best.gridImportMw ? point : best);
  return <section className="operations-v2-view ops-canonical ops-canonical--overview"
    data-assessment-id={identity} data-inspected-time={inspected}>
    <h2 className="sr-only">Optimised facility plan</h2>
    <CanonicalOperatingSummary assessment={a} />
    <article className="operations-v2-chart-card">
      <ChartHeader eyebrow={`${a.points.length} modelled intervals · full horizon · UTC`} title="Compare power responses" badge="MILP · synthetic" />
      <p className="operations-chart-purpose">Submitted baseline compared with the joint workload & battery plan.</p>
      <PowerTimeline data={displayed} limitMw={a.limitMw} targetMw={a.targetMw} protectedSocPercent={a.protectedSocPercent}
        selectedTimestamp={inspected} onSelect={onSelect} mode="scenario" variant="overview" showConstraints={false}
        previewing={preview !== null} overviewPresentation />
      <OverviewImpact impact={canonicalImpact(a)} onSelect={onSelect} />
      <div className="ops-inspection-caption"><span>Chart inspection range · {formatOperationsTime(displayed[0].timestamp, true)}–{formatOperationsTime(displayed.at(-1)!.endTimestamp!, true)}</span>
        <span>Summary, impact & checks: full horizon</span></div>
      <div className="ops-canonical-inspection-toolbar">
        <InspectionRange model={{ intervals: a.points.map(point => ({ timestamp: point.timestamp, label: formatOperationsTime(point.timestamp) })) }}
          range={currentRange} setInspectionRange={value => setRange({ identity, ...value })} inspection={{ select: onSelect }} />
        <IntervalNavigation points={a.points} timestamp={timestamp} onSelect={onSelect} peak={peak.timestamp} peakLabel="Inspect plan peak" />
        {currentRange ? <button type="button" className="secondary-button" onClick={() => setRange(null)}>Reset inspection range</button> : null}
      </div>
      <p className="ops-canonical-selected" role="status" aria-label="Selected interval facts">
        At {formatOperationsTime(selected.timestamp)} · grid import {formatMw(selected.gridImportMw)} · battery {formatMw(selected.batteryPowerMw ?? 0)}
      </p>
      <PowerDataTable data={a.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp} onSelect={onSelect} onPreview={onPreview} mode="scenario" context="overview" />
      <CanonicalOverviewDetails assessment={a} index={index} />
      <CanonicalResultDetails assessment={a} includeGuidance />
    </article>
  </section>;
}
