import type { CanonicalBatteryViewModel } from "./canonical-battery-view";
import { BatteryReserveGauge } from "./power/BatteryReserveGauge";
import { formatMw, formatMwh, formatPercent } from "./formatting";
import { intervalLabel } from "./power/select-battery-workspace";

export function CanonicalBatteryInspector({ model: m, target, limit }: {
  model: CanonicalBatteryViewModel; target: number; limit: number;
}) {
  const { selected: p, audit } = m;
  return <aside className="battery-interval-inspector" aria-label="Selected battery interval">
    <header aria-live="polite"><p className="context-label">Selected interval · modelled</p>
      <strong>{intervalLabel(p)}</strong><span>Joint workload & battery plan</span></header>
    {audit ? <article className="battery-soc-card"><header><h3>State of Charge & Reserve</h3></header>
      <div className="battery-soc-body">
        <BatteryReserveGauge soc={p.socPercent} protectedSoc={audit.protectedSocPercent} maximumSoc={audit.maximumSocPercent}>
          End-of-interval SOC · fixed health-adjusted capacity. Not measured telemetry.
        </BatteryReserveGauge>
        <dl className="battery-interval-facts">
          <div><dt>Start → end SOC</dt><dd>{formatPercent(p.startingSocPercent!)} → {formatPercent(p.socPercent!)}</dd></div>
          <div><dt>Protected reserve</dt><dd>{formatPercent(audit.protectedSocPercent)}</dd></div>
          <div><dt>Maximum SOC</dt><dd>{formatPercent(audit.maximumSocPercent)}</dd></div>
          <div><dt>Energy above reserve · DC</dt><dd>{formatMwh(m.energyAboveReserveMwh!)}</dd></div>
        </dl>
      </div></article> : <p>No battery in this plan. Battery reserve checks are not applicable.</p>}
    <dl className="battery-interval-facts" aria-label="Model checks">
      <div><dt>Grid import</dt><dd>{formatMw(p.gridImportMw)}</dd></div>
      <div><dt>Safety-target margin</dt><dd>{formatMw(target - p.gridImportMw)}</dd></div>
      <div><dt>Facility-limit margin</dt><dd>{formatMw(limit - p.gridImportMw)}</dd></div>
      <div><dt>Full-horizon terminal target</dt><dd>{!audit ? "Not applicable" : m.facts.terminalTargetsMet === null ? "Unavailable" : m.facts.terminalTargetsMet ? "Met within model" : "Unresolved"}</dd></div>
    </dl>
    <details><summary>Inspect SOC accounting</summary><p>SOC {audit ? formatPercent(p.socPercent!) : "Unavailable"} · reserve {audit ? formatPercent(audit.protectedSocPercent) : "Not applicable"}.
      Stored energy and reserve are DC; dispatch power and integrated charging/discharging energy are AC. Backup autonomy is not guaranteed.</p></details>
  </aside>;
}
