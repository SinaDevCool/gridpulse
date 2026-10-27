import type { CanonicalPresentation } from "./canonical-presentation";
import type { CanonicalBatteryViewModel } from "./canonical-battery-view";
import { PowerBalanceDiagram } from "./PowerBalanceDiagram";
import { formatMw, formatMwh, formatPercent } from "./formatting";

export function CanonicalBatteryDetails({ assessment: a, model: m }: { assessment: CanonicalPresentation; model: CanonicalBatteryViewModel }) {
  const asset = a.request.batteries?.[0];
  const config = asset && typeof asset === "object" ? asset as Record<string, unknown> : null;
  return <>
    <details className="operations-assurance-panel"><summary>Full-horizon battery summary</summary>
      <dl className="ops-compact-facts">
        <div><dt>Discharge energy · AC</dt><dd>{formatMwh(m.dischargeMwh)}</dd></div>
        <div><dt>Charge energy · AC</dt><dd>{formatMwh(m.chargeMwh)}</dd></div>
        <div><dt>Initial → end SOC</dt><dd>{m.audit ? `${formatPercent(m.audit.initialSocPercent)} → ${formatPercent(m.endSoc!)}` : "Not applicable"}</dd></div>
        <div><dt>Minimum SOC · includes initial</dt><dd>{m.minimumSoc == null ? "Not applicable" : formatPercent(m.minimumSoc)}</dd></div>
        <div><dt>Terminal energy / target · DC</dt><dd>{m.terminal ? `${formatMwh(m.terminal.endMwh)} / ${formatMwh(m.terminal.targetMwh)}` : "Not applicable"}</dd></div>
      </dl><p>Full planning horizon. Charging losses mean AC charge and discharge totals need not match.</p>
    </details>
    <details className="operations-assurance-panel"><summary>Power path</summary>
      <h3>Selected-interval facility power balance</h3>
      {m.flow ? <PowerBalanceDiagram balance={m.flow} limitMw={m.selected.limitMw} /> :
        <p role="status">Ribbon view unavailable for generation/export or unreconciled accounting. Returned components are shown below; no flows are estimated.</p>}
      <dl className="ops-compact-facts">{m.components.map(component => <div key={component.label}><dt>{component.label}</dt><dd>{component.value == null ? "Unavailable" : formatMw(component.value)}</dd></div>)}</dl>
      <p>Modelled components, not measured submeter readings. Workload power is not substituted for total IT load.</p>
    </details>
    <details className="operations-assurance-panel"><summary>Submitted battery limits</summary>
      {m.audit ? <><dl className="ops-compact-facts">
        <div><dt>Health-adjusted capacity · DC</dt><dd>{formatMwh(m.audit.capacity)}</dd></div>
        <div><dt>Protected energy · DC</dt><dd>{formatMwh(m.audit.reserve)}</dd></div>
        {[['Rated power', 'rated_power_mw'], ['Maximum charge power', 'maximum_charge_power_mw'], ['Discharge efficiency', 'discharge_efficiency'], ['Charge efficiency', 'charge_efficiency']].map(([label, key]) =>
          <div key={key}><dt>{label}{key.includes('efficiency') ? ' · ratio' : ' · MW'}</dt><dd>{typeof config?.[key] === "number" ? String(config[key]) : "Not supplied"}</dd></div>)}
      </dl><p>Reserve, efficiency, continuity and terminal energy use the existing accepted replay audit. Temperature, alarms, inverter telemetry and causal binding constraints are not inferred.</p></> : <p>No battery submitted.</p>}
    </details>
  </>;
}
