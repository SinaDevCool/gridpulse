import { Database, Network, ShieldCheck, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import {
  capacityMetricLabels,
  referenceCapacityValue,
  type CapacityMetric,
  type ReferenceCapacityArtifact,
  type ReferenceCapacityResult,
} from "@/features/power-finder/calculated-capacity";

export function ReferenceCapacityInset({
  artifact,
  metric,
  selected,
  onSelect,
  onExplore,
}: {
  artifact: ReferenceCapacityArtifact;
  metric: CapacityMetric;
  selected: ReferenceCapacityResult | null;
  onSelect: (result: ReferenceCapacityResult | null) => void;
  onExplore: (result: ReferenceCapacityResult) => void;
}) {
  const maximum = Math.max(
    0.001,
    ...artifact.results.map((item) => referenceCapacityValue(item, metric)),
  );
  return (
    <section
      className="reference-capacity-inset"
      aria-label="Reference network calculated capacity"
    >
      <header>
        <div>
          <Network aria-hidden="true" />
          <span>
            <strong>Reference capacity lab</strong>
            <small>SimBench network · not the OpenStreetMap grid</small>
          </span>
        </div>
        <span className="reference-capacity-badge">
          <ShieldCheck aria-hidden="true" /> Calculated reference
        </span>
      </header>
      <div className="reference-capacity-boundary" role="note">
        These MW values are Pandapower results on an open SimBench model. They are not capacity at
        any mapped public node or named substation.
      </div>
      <div className="reference-capacity-grid">
        {artifact.results.map((result) => {
          const value = referenceCapacityValue(result, metric);
          const intensity = 0.22 + (value / maximum) * 0.78;
          return (
            <button
              key={result.result_id}
              type="button"
              className={selected?.result_id === result.result_id ? "is-selected" : ""}
              style={{ "--capacity-intensity": intensity } as CSSProperties}
              onClick={() => onSelect(result)}
              aria-label={`${result.label}, ${capacityMetricLabels[metric]} ${value} megawatts`}
            >
              <i aria-hidden="true" />
              <b>{result.label}</b>
              <span>{value.toFixed(2)} MW</span>
              <small>{result.reference_bus_id}</small>
            </button>
          );
        })}
      </div>
      {selected && (
        <aside className="reference-capacity-detail">
          <div className="reference-capacity-detail-heading">
            <strong>{selected.label} activation envelope</strong>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Close reference result"
            >
              ×
            </button>
          </div>
          <dl>
            <div>
              <dt>Activatable</dt>
              <dd>{selected.activatable_capacity_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>Additional unlocked</dt>
              <dd>{selected.additional_unlocked_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>Scenario range (P10 / P50 / P90)</dt>
              <dd>
                {selected.ensemble.confidence.p10_mw.toFixed(2)} /{" "}
                {selected.ensemble.confidence.p50_mw.toFixed(2)} /{" "}
                {selected.ensemble.confidence.p90_mw.toFixed(2)} MW
              </dd>
            </div>
            <div>
              <dt>Operating evidence</dt>
              <dd>
                {selected.ensemble.scenario_count} scenarios ·{" "}
                {selected.ensemble.hours_evaluated.toLocaleString()} h
              </dd>
            </div>
            <div>
              <dt>N-0 calculated</dt>
              <dd>{selected.n0_capacity_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>N-1 firm</dt>
              <dd>{selected.n1_capacity_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>Flexible hypothesis</dt>
              <dd>{selected.flexible_capacity_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>BESS-assisted hypothesis</dt>
              <dd>{selected.bess_assisted_capacity_mw.toFixed(3)} MW</dd>
            </div>
            <div>
              <dt>Binding case</dt>
              <dd>{selected.binding_case ?? "None"}</dd>
            </div>
            <div>
              <dt>Constraint</dt>
              <dd>{selected.binding_constraint?.replaceAll("_", " ") ?? "None"}</dd>
            </div>
            <div>
              <dt>Flexible restrictions</dt>
              <dd>{selected.activation.flexible.restricted_hours} h/year</dd>
            </div>
            <div>
              <dt>Restricted energy</dt>
              <dd>{selected.activation.flexible.restricted_energy_mwh.toFixed(1)} MWh</dd>
            </div>
            <div>
              <dt>Longest event</dt>
              <dd>{selected.activation.flexible.longest_event_hours} h</dd>
            </div>
            <div>
              <dt>Demand served</dt>
              <dd>{selected.activation.flexible.demand_served_percent.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Representative BESS</dt>
              <dd>
                {selected.activation.bess_assisted.battery_power_mw} MW /{" "}
                {selected.activation.bess_assisted.battery_energy_mwh} MWh
              </dd>
            </div>
          </dl>
          <div className="reference-capacity-explanation">
            <Sparkles aria-hidden="true" />
            <p>
              <strong>Grounded interpretation</strong>The graph pathway is traceable, while the
              demonstrated radial N‑1 outage removes firm supply. Flexible, storage and staged
              figures are explicit screening assumptions—not operator offers.
            </p>
          </div>
          <button
            type="button"
            className="primary-button reference-capacity-explore"
            onClick={() => onExplore(selected)}
          >
            Explore activation options
          </button>
          <details className="reference-capacity-evidence">
            <summary>Calculation evidence</summary>
            <p>{selected.activation.calculation_boundary}</p>
            <p>{selected.ensemble.confidence.interpretation}</p>
            <p>
              <strong>Dominant uncertainty:</strong> {selected.ensemble.dominant_uncertainty}
            </p>
            <code>{selected.activation.result_sha256}</code>
            <code>{selected.ensemble.scenario_set_sha256}</code>
          </details>
        </aside>
      )}
      <footer>
        <span>
          <Database aria-hidden="true" /> {artifact.model.code} · {artifact.model.licence}
        </span>
        <span>
          Pandapower {artifact.solver.version} · topology{" "}
          {artifact.model.topology_provider.replaceAll("_", " ")}
        </span>
        {artifact.release2_governance && (
          <span>
            Release 2:{" "}
            {artifact.release2_governance.active_learning.physics_verified_selected_count}/
            {artifact.release2_governance.active_learning.candidate_count} AI-prioritised cases
            verified by physics
          </span>
        )}
        {artifact.release3_governance && (
          <span>
            Release 3: {artifact.release3_governance.shadow.verified_count}/
            {artifact.release3_governance.shadow.scenario_count} shadow cases verified ·{" "}
            {artifact.release3_governance.champion_decision.decision.replaceAll("_", " ")}
          </span>
        )}
        {artifact.release4_governance && (
          <span>
            Release 4: {artifact.release4_governance.repository_acceptance.passed_gate_count}/
            {artifact.release4_governance.repository_acceptance.total_gate_count} pilot gates passed
            {" · "}operator data{" "}
            {artifact.release4_governance.operator_replacement.operator_field_count}/
            {artifact.release4_governance.operator_replacement.required_field_count}
          </span>
        )}
        {artifact.release5_governance && (
          <span>
            Release 5: {Object.values(artifact.release5_governance.gates).filter(Boolean).length}/
            {Object.keys(artifact.release5_governance.gates).length} operator-control gates passed
            {" · "}no dispatch or capacity confirmation
          </span>
        )}
      </footer>
    </section>
  );
}
