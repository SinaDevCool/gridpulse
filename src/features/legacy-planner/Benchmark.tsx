import { BarChart3,Database } from "lucide-react";

import {
peerStatistic,
validMetricValues,
type RzregPerformanceRecord,
} from "@/features/data-centre-planner/benchmark";

import { BarComparison } from "@/features/data-centre-planner/analytics-charts";

import { type Artifact,type Project } from "./contracts";

import { DecisionNote,Empty,Title } from "./primitives";

export function Benchmark({
  project,
  peers,
  artifact,
}: {
  project: Project;
  peers: RzregPerformanceRecord[];
  artifact: Artifact | null;
}) {
  if (project.it === null)
    return (
      <Empty
        title="Choose a comparison scale"
        copy="Enter connected IT load to select a defensible RZReg peer cohort."
      />
    );
  const items = [
    ["PUE", project.pue, "pue", ""],
    ["Renewable factor", project.ref, "renewable_energy_factor_pct", "%"],
    ["Energy reuse", project.erf, "energy_reuse_factor_pct", "%"],
    ["WUE", project.wue, "wue_l_per_kwh_it", " L/kWh"],
  ] as const;
  const percentileItems = items.map(([label, value, key]) => {
    const values = validMetricValues(peers, key).sort((a, b) => a - b);
    const percentile =
      value === null || values.length === 0
        ? null
        : (values.filter((candidate) => candidate <= value).length / values.length) * 100;
    return { label, value: percentile, color: "#8b75ff", note: "Rank within valid cohort" };
  });
  return (
    <>
      <Title
        over="German public benchmark"
        title="How does the design compare?"
        copy={`${peers.length} records in the connected-IT-load cohort. Invalid fields are excluded metric by metric.`}
      />
      <div className="dca-benchmark-grid">
        {items.map(([label, value, key, unit]) => {
          const s = peerStatistic(peers, key),
            pos =
              value === null
                ? null
                : s.p75 === s.p25
                  ? 50
                  : Math.max(0, Math.min(100, ((value - s.p25) / (s.p75 - s.p25)) * 100));
          return (
            <article className="dca-card" key={label}>
              <span>{label}</span>
              <h3>{value === null ? "Project value missing" : `${value}${unit}`}</h3>
              <div className="dca-range">
                <span />
                <i style={pos === null ? { display: "none" } : { left: `${pos}%` }} />
              </div>
              <div className="dca-range-labels">
                <small>P25 {s.p25}</small>
                <small>Median {s.median}</small>
                <small>P75 {s.p75}</small>
              </div>
              <p>
                {s.count} valid · {peers.length - s.count} excluded/missing
              </p>
            </article>
          );
        })}
      </div>
      <div className="dca-source">
        <Database />
        <span>
          RZReg public artifact · {artifact?.metadata.record_count ?? 0} records ·{" "}
          {artifact?.metadata.validation_warning_count ?? 0} quarantined warnings
        </span>
      </div>
      <div className="dca-grid-2 dca-section-gap">
        <article className="dca-card">
          <BarComparison
            title="Project percentile within selected cohort"
            unit="percentile"
            items={percentileItems}
          />
        </article>
        <article className="dca-card dca-callout">
          <BarChart3 />
          <h3>Benchmark interpretation</h3>
          <p>
            Renewable-factor results clustered at 100% provide little differentiation. PUE and WUE
            provide more useful design context; ERF highlights a potential heat-reuse opportunity
            but not technical feasibility.
          </p>
        </article>
      </div>
      <DecisionNote
        title="Use peer data as context, not a site forecast"
        copy="RZReg describes reporting facilities. It does not establish Berlin grid capacity, local energy prices or the operating performance of the proposed facility."
      />
    </>
  );
}
