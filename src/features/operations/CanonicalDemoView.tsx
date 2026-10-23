import type { CanonicalDemo } from "./canonical-demo";
import type { OperationsView } from "./view-contracts";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { CanonicalExecutionLanes } from "./compute/WorkloadWindowLanes";

export function CanonicalDemoView({ demo, view, timestamp, onSelect, preview, onPreview }: {
  demo: CanonicalDemo; view: OperationsView; timestamp: string; onSelect: (value: string) => void;
  preview: string | null; onPreview: (value: string | null) => void;
}) {
  const inspected = preview ?? timestamp;
  const selected = demo.points.find(point => point.timestamp === inspected) ?? demo.points[0];
  return <article className="power-timeline-card" data-assessment-id={demo.projected.identity.resultFingerprint}>
    <header><p className="context-label">Synthetic MILP demonstration · read-only</p>
      <h2>{view === "compute" ? "Solved workload schedule" : view === "power" ? "Joint-plan battery response" : "Optimised facility plan"}</h2>
      <p>{demo.projected.identity.status === "optimal" ? "Optimal" : "Feasible incumbent—not proven optimal"} · {demo.projected.identity.engineVersion} · physical replay passed</p>
    </header>
    <p>Baseline peak {formatMw(demo.baselinePeakMw)} → plan peak {formatMw(demo.planPeakMw)}. Full horizon: {demo.points.length} intervals. No live dispatch.</p>
    <label>Inspect interval <select value={timestamp} onChange={event => onSelect(event.target.value)}>
      {demo.points.map(point => <option key={point.timestamp} value={point.timestamp}>{formatOperationsTime(point.timestamp)}</option>)}
    </select></label>
    <p role="status">{formatOperationsTime(selected.timestamp)} · grid import {formatMw(selected.gridImportMw)} · battery {formatMw(selected.batteryPowerMw ?? 0)}</p>
    <PowerTimeline data={demo.points} limitMw={demo.limitMw} targetMw={demo.targetMw}
      protectedSocPercent={demo.protectedSocPercent} selectedTimestamp={inspected}
      onSelect={onSelect} mode="scenario" previewing={preview !== null} />
    {view === "compute" ? <CanonicalExecutionLanes demo={demo} timestamp={inspected} onSelect={onSelect} /> : null}
    <PowerDataTable data={demo.points} selectedTimestamp={inspected} pinnedTimestamp={timestamp}
      onSelect={onSelect} onPreview={onPreview} mode="scenario" />
    <details><summary>Assessment identity and fixed input model</summary>
      <p>Fingerprint: {demo.projected.identity.resultFingerprint}</p>
      <p>Calculation method: MILP. Provenance: synthetic. PUE is reference-only in component accounting.</p>
      <pre>{JSON.stringify(demo.request, null, 2)}</pre>
    </details>
  </article>;
}
