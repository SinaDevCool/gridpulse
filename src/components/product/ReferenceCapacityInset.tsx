import { Database, Network, ShieldCheck, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import {
  capacityMetricLabels,
  referenceCapacityValue,
  type CapacityMetric,
  type ReferenceCapacityArtifact,
  type ReferenceCapacityResult,
} from "@/features/power-finder/calculated-capacity";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

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
    <section className="reference-capacity-inset" aria-labelledby="reference-workspace-title">
      <header>
        <div>
          <Network aria-hidden="true" />
          <span>
            <strong id="reference-workspace-title">Reference Network Demo</strong>
            <small>Abstract SimBench topology · separate from the geographic map</small>
          </span>
        </div>
        <span className="reference-capacity-badge">
          <ShieldCheck aria-hidden="true" /> Reference Calculated
        </span>
      </header>
      <div className="reference-capacity-boundary" role="note">
        These Pandapower results demonstrate the method on an open model. They are not capacity at
        a mapped public node or named substation.
      </div>
      <div className="reference-network-canvas">
        <svg viewBox="0 0 1000 520" role="img" aria-label="Abstract reference network topology">
          <title>Abstract SimBench reference network</title>
          <path d="M85 260 H250 L350 110 H540 L650 260 H910" />
          <path d="M250 260 L350 410 H540 L650 260" />
          <path d="M350 110 L350 410 M540 110 L540 410" />
        </svg>
        <div className="reference-capacity-grid">
          {artifact.results.map((result, index) => {
            const value = referenceCapacityValue(result, metric);
            const intensity = 0.22 + (value / maximum) * 0.78;
            return (
              <button
                key={result.result_id}
                type="button"
                className={selected?.result_id === result.result_id ? "is-selected" : ""}
                style={{
                  "--capacity-intensity": intensity,
                  "--reference-index": index,
                } as CSSProperties}
                onClick={() => onSelect(result)}
                aria-label={`Reference bus ${String(index + 1).padStart(2, "0")}, ${capacityMetricLabels[metric]} ${number.format(value)} megawatts`}
              >
                <i aria-hidden="true" />
                <b>Bus {String(index + 1).padStart(2, "0")}</b>
                <span>{number.format(value)} MW</span>
                <small translate="no">{result.reference_bus_id}</small>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="reference-workspace-footer">
        <span><Database aria-hidden="true" /> {artifact.model.code} · {artifact.model.licence}</span>
        <span>Pandapower {artifact.solver.version} · {artifact.results.length} solved buses</span>
      </footer>
      {selected && (
        <aside className="reference-capacity-detail" aria-label="Selected reference bus summary">
          <div className="reference-capacity-detail-heading">
            <div>
              <span>Selected Reference Bus</span>
              <strong>{selected.label.replace(/^REF\s*/i, "Bus ")}</strong>
              <small translate="no">{selected.reference_bus_id}</small>
            </div>
            <button type="button" onClick={() => onSelect(null)} aria-label="Close reference result">
              <X aria-hidden="true" />
            </button>
          </div>
          <dl>
            <div><dt>Activatable</dt><dd>{number.format(selected.activatable_capacity_mw)} MW</dd></div>
            <div><dt>Additional Unlocked</dt><dd>{number.format(selected.additional_unlocked_mw)} MW</dd></div>
            <div><dt>N-0 Calculated</dt><dd>{number.format(selected.n0_capacity_mw)} MW</dd></div>
            <div><dt>N-1 Firm</dt><dd>{number.format(selected.n1_capacity_mw)} MW</dd></div>
            <div><dt>Scenario Range</dt><dd>{number.format(selected.ensemble.confidence.p10_mw)}–{number.format(selected.ensemble.confidence.p90_mw)} MW</dd></div>
            <div><dt>Primary Constraint</dt><dd>{selected.binding_constraint?.replaceAll("_", " ") ?? "None recorded"}</dd></div>
          </dl>
          <div className="reference-capacity-explanation">
            <Sparkles aria-hidden="true" />
            <p><strong>What this demonstrates</strong>Graph-traced constraints, hourly physics and flexibility hypotheses on a representative network. The demonstrated radial N‑1 outage removes firm supply.</p>
          </div>
          <button type="button" className="primary-button reference-capacity-explore" onClick={() => onExplore(selected)}>
            Explore Activation Options
          </button>
          <details className="reference-capacity-evidence">
            <summary>Model &amp; Calculation Evidence</summary>
            <p>{selected.activation.calculation_boundary}</p>
            <p>{selected.ensemble.confidence.interpretation}</p>
            <p><strong>Dominant uncertainty:</strong> {selected.ensemble.dominant_uncertainty}</p>
          </details>
        </aside>
      )}
    </section>
  );
}
