import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, CircleHelp, Minus } from "lucide-react";
import type { CanonicalBatteryViewModel } from "./canonical-battery-view";
import { BatteryReserveGauge } from "./power/BatteryReserveGauge";
import { formatMw, formatMwh, formatPercent } from "./formatting";
import { intervalLabel } from "./power/select-battery-workspace";

export function CanonicalBatteryInspector({ model: m }: { model: CanonicalBatteryViewModel }) {
  const { selected: p, audit, accounting, terminal } = m;
  const DirectionIcon = m.direction === "Charging" ? ArrowDownLeft : m.direction === "Discharging" ? ArrowUpRight : Minus;
  const TerminalIcon = terminal?.state === "met" ? CheckCircle2 : terminal?.state === "unresolved" ? CircleAlert : CircleHelp;
  return <aside className="battery-interval-inspector canonical-battery-inspector" aria-label="Selected battery interval">
    <header><p className="context-label">Inspected interval · modelled</p><strong>{intervalLabel(p)}{new Date(p.endTimestamp!).getUTCDate() !== new Date(p.timestamp).getUTCDate() ? " · next day" : ""}</strong>
      {audit ? <span className="canonical-dispatch-state"><DirectionIcon aria-hidden="true" />{m.direction} · {formatMw(Math.abs(p.batteryPowerMw ?? 0))} AC</span> : null}</header>
    {audit ? <section className="canonical-battery-state" aria-label="Battery state and reserve">
      <h3>State of charge</h3>
      <BatteryReserveGauge soc={p.socPercent} protectedSoc={audit.protectedSocPercent} maximumSoc={audit.maximumSocPercent}>
        Modelled interval end · not telemetry
      </BatteryReserveGauge>
      <dl className="canonical-soc-bounds"><div><dt>Protected reserve</dt><dd>{formatPercent(audit.protectedSocPercent)}</dd></div>
        <div><dt>Maximum SOC</dt><dd>{formatPercent(audit.maximumSocPercent)}</dd></div></dl>
      <div className="canonical-soc-transition" aria-label="Interval SOC transition"><span>Start <strong>{formatPercent(p.startingSocPercent!)}</strong></span>
        <ArrowRight aria-hidden="true" /><span>End <strong>{formatPercent(p.socPercent!)}</strong></span></div>
      <dl className="canonical-reserve-energy"><div><dt>Energy above reserve · DC</dt><dd>{formatMwh(m.energyAboveReserveMwh!)}</dd></div></dl>
    </section> : <p className="canonical-no-battery">No battery in this plan. Battery reserve checks are not applicable.</p>}
    <section className="canonical-battery-margins" aria-label="Selected interval operating margins">
      <h3>Grid import <strong>{formatMw(p.gridImportMw)}</strong></h3>
      <dl>{[{ label: "Safety-target margin", value: m.margins.safety }, { label: "Facility-limit margin", value: m.margins.facility }].map(fact =>
        <div key={fact.label} data-state={fact.value < -.01 ? "exceeded" : fact.value > .01 ? "below" : "at"}>
          <dt>{fact.label}</dt><dd>{formatMw(fact.value)}</dd><dd className="canonical-margin-meaning">{fact.value < -.01 ? "Exceeds threshold" : fact.value > .01 ? "Below threshold" : "At threshold"}</dd></div>)}</dl>
    </section>
    {terminal ? <section className="canonical-terminal-check" data-state={terminal.state} aria-label="Full-horizon terminal target">
      <h3>End-of-plan target</h3><p><TerminalIcon aria-hidden="true" /><strong>{terminal.state === "met" ? "Met within model" : terminal.state === "unresolved" ? "Unresolved" : "Check unavailable"}</strong></p>
      <dl><div><dt>End energy / target · DC</dt><dd>{formatMwh(terminal.endMwh)} / {formatMwh(terminal.targetMwh)}</dd></div></dl>
      <small>Full horizon · independent of inspected time</small>
    </section> : null}
    {accounting ? <details className="canonical-energy-accounting"><summary>Energy accounting</summary>
      <h4>Stored energy · DC</h4><dl>
        <div><dt>Interval start</dt><dd>{formatMwh(accounting.storedStartMwh)}</dd></div>
        <div><dt>Interval end</dt><dd>{formatMwh(accounting.storedEndMwh)}</dd></div>
        <div><dt>Protected energy</dt><dd>{formatMwh(accounting.protectedMwh)}</dd></div>
        <div><dt>Health-adjusted capacity</dt><dd>{formatMwh(accounting.capacityMwh)}</dd></div></dl>
      <p className="canonical-energy-equation">Stored − protected = energy above reserve. SOC uses the fixed health-adjusted capacity.</p>
      <h4>This interval · AC</h4><dl><div><dt>Charge energy</dt><dd>{formatMwh(accounting.acChargeMwh)}</dd></div>
        <div><dt>Discharge energy</dt><dd>{formatMwh(accounting.acDischargeMwh)}</dd></div></dl>
      <p>AC flow energy and DC storage changes differ because of efficiency and any modelled self-discharge. Energy above reserve is not a backup-duration guarantee.</p>
    </details> : null}
    <p className="canonical-battery-provenance">Modelled plan · no equipment commands</p>
  </aside>;
}
