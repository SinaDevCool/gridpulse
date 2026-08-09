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
}: {
  artifact: ReferenceCapacityArtifact;
  metric: CapacityMetric;
  selected: ReferenceCapacityResult | null;
  onSelect: (result: ReferenceCapacityResult | null) => void;
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
          </dl>
          <div className="reference-capacity-explanation">
            <Sparkles aria-hidden="true" />
            <p>
              <strong>Grounded interpretation</strong>The graph pathway is traceable, while the
              demonstrated radial N‑1 outage removes firm supply. Flexible, storage and staged
              figures are explicit screening assumptions—not operator offers.
            </p>
          </div>
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
      </footer>
    </section>
  );
}
