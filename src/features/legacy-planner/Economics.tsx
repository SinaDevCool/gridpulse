import { Leaf } from "lucide-react";

import {
BarComparison,
EvidenceLegend,
SensitivityMatrix,
} from "@/features/data-centre-planner/analytics-charts";

import { type Design,type FlexResult,type Project,type TechId } from "./contracts";

import { DecisionNote,Empty,Metric,Title } from "./primitives";

import { TECHNOLOGIES,eur,fmt } from "./presentation";

export function Economics({
  design,
  project,
  annualCost,
  results,
}: {
  design: Design;
  project: Project;
  annualCost: number | null;
  results: Record<TechId, FlexResult>;
}) {
  if (!design)
    return (
      <Empty
        title="Energy case not ready"
        copy="Complete Energy inputs before reviewing operating economics."
      />
    );
  const completed = TECHNOLOGIES.map((technology) => ({
    technology,
    result: results[technology.id],
  })).filter(
    (
      entry,
    ): entry is { technology: (typeof TECHNOLOGIES)[number]; result: NonNullable<FlexResult> } =>
      entry.result !== null,
  );
  const lowestLcos = completed.length
    ? [...completed].sort((a, b) => a.result.lcosEurPerMwh - b.result.lcosEurPerMwh)[0]
    : null;
  const basePue = project.pue!;
  const basePrice = project.price;
  const sensitivityRows = [Math.max(1, basePue - 0.1), basePue, basePue + 0.1];
  const sensitivityColumns =
    basePrice === null ? [] : [Math.max(0, basePrice - 30), basePrice, basePrice + 30];
  return (
    <>
      <Title
        over="Project economics"
        title="Known exposure vs missing evidence"
        copy="No financial result appears until its required customer input exists."
      />
      <EvidenceLegend />
      <div className="dca-metrics">
        <Metric
          label="Annual electricity"
          value={`${fmt.format(design.annualFacilityEnergyGwh)} GWh`}
          note="Calculated demand"
        />
        <Metric
          label="Energy price"
          value={project.price === null ? "Missing" : `${eur.format(project.price)}/MWh`}
          note="Customer input"
        />
        <Metric
          label="Electricity spend"
          value={annualCost === null ? "Unavailable" : eur.format(annualCost)}
          note="Excludes taxes and grid charges"
        />
        <Metric
          label="Flexibility LCOS"
          value={lowestLcos ? `${eur.format(lowestLcos.result.lcosEurPerMwh)}/MWh` : "Unavailable"}
          note="Complete supplier inputs required"
        />
      </div>
      <div className="dca-grid-2">
        <article className="dca-card">
          <BarComparison
            title="Known annual cost exposure"
            unit="M€/year"
            items={[
              {
                label: "Commodity electricity",
                value: annualCost === null ? null : annualCost / 1_000_000,
                color: "#49d3ff",
                note: "Customer price × calculated demand",
              },
              { label: "Grid charges and levies", value: null, note: "Missing evidence" },
              {
                label: "Connection and reinforcement",
                value: null,
                note: "Missing operator/project evidence",
              },
              {
                label: "Lowest complete flexibility case",
                value: lowestLcos ? lowestLcos.result.annualCostEur / 1_000_000 : null,
                color: "#8b75ff",
                note: lowestLcos?.technology.name ?? "No complete scenario",
              },
            ]}
          />
        </article>
        {sensitivityColumns.length > 0 ? (
          <SensitivityMatrix
            title="Annual electricity-cost sensitivity"
            rows={sensitivityRows}
            columns={sensitivityColumns}
            calculate={(pue, price) =>
              ((project.it! * project.load!) / 100) * 8.76 * pue * 1000 * price
            }
          />
        ) : (
          <article className="dca-card">
            <Empty
              title="Sensitivity unavailable"
              copy="Enter an electricity price to calculate the PUE and price matrix."
            />
          </article>
        )}
      </div>
      {completed.length > 0 && (
        <article className="dca-card dca-wide-chart">
          <BarComparison
            title="Flexibility annual-cost comparison"
            unit="M€/year"
            items={completed.map(({ technology, result }) => ({
              label: technology.name,
              value: result.annualCostEur / 1_000_000,
              color: "#54d6a6",
            }))}
          />
        </article>
      )}
      <article className="dca-card dca-callout">
        <Leaf />
        <h3>Investment decision unavailable</h3>
        <p>
          A defensible NPV needs contracted prices, tariffs, connection and construction costs,
          taxes, financing, revenues and chronological dispatch. RZReg cannot supply them.
        </p>
      </article>
      <DecisionNote
        title={
          lowestLcos
            ? `${lowestLcos.technology.name} is the lowest-LCOS complete scenario—not yet a recommendation`
            : "Complete at least 1 supplier-backed flexibility scenario"
        }
        copy={
          lowestLcos
            ? "Compare site feasibility, reliability role, warranty, degradation and chronological dispatch before selecting a technology."
            : "Add technology costs and evidence references. NPV and payback remain unavailable until the wider commercial case is complete."
        }
      />
    </>
  );
}
