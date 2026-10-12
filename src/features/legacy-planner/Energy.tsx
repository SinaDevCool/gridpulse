import { Gauge,Zap } from "lucide-react";

import { BarComparison,WaterfallChart } from "@/features/data-centre-planner/analytics-charts";

import { type Design } from "./contracts";

import { DecisionNote,Empty,Line,Title } from "./primitives";

import { eur,fmt } from "./presentation";

export function Energy({ design, annualCost }: { design: Design; annualCost: number | null }) {
  if (!design)
    return (
      <Empty
        title="Define the energy design"
        copy="Add IT load, PUE, load factor, REF, ERF and WUE. No project values are prefilled."
      />
    );
  return (
    <>
      <Title
        over="Energy design"
        title="Demand, efficiency & resource exposure"
        copy="Calculated only from customer-entered project assumptions."
      />
      <div className="dca-grid-2">
        <article className="dca-card">
          <header>
            <Zap />
            <div>
              <span>Annual energy composition</span>
              <h3>{fmt.format(design.annualFacilityEnergyGwh)} GWh</h3>
            </div>
          </header>
          <WaterfallChart
            title="Annual facility energy"
            unit="GWh"
            items={[
              {
                label: "IT energy",
                value: design.annualItEnergyGwh,
                color: "#49d3ff",
                note: "IT load × load factor",
              },
              {
                label: "PUE overhead",
                value: design.annualOverheadEnergyGwh,
                color: "#8b75ff",
                note: "Cooling and electrical overhead",
              },
              {
                label: "Facility total",
                value: design.annualFacilityEnergyGwh,
                color: "#54d6a6",
                note: "Calculated annual demand",
              },
            ]}
          />
        </article>
        <article className="dca-card">
          <header>
            <Gauge />
            <div>
              <span>Resource consequences</span>
              <h3>Operational design signals</h3>
            </div>
          </header>
          <div className="dca-kpi-list">
            <Line label="Peak facility import" value={`${fmt.format(design.facilityPeakMw)} MW`} />
            <Line
              label="Renewable target"
              value={`${fmt.format(design.annualRenewableEnergyGwh)} GWh/y`}
            />
            <Line
              label="Reusable heat scenario"
              value={`${fmt.format(design.annualReusableHeatGwh)} GWh/y`}
            />
            <Line label="Water scenario" value={`${fmt.format(design.annualWaterM3)} m³/y`} />
            <Line
              label="Electricity spend"
              value={annualCost === null ? "Add price" : eur.format(annualCost)}
            />
          </div>
        </article>
      </div>
      <article className="dca-card dca-wide-chart">
        <BarComparison
          title="Annual resource exposure"
          unit="GWh"
          items={[
            { label: "Facility energy", value: design.annualFacilityEnergyGwh, color: "#49d3ff" },
            { label: "Renewable target", value: design.annualRenewableEnergyGwh, color: "#54d6a6" },
            {
              label: "Reusable heat scenario",
              value: design.annualReusableHeatGwh,
              color: "#efb743",
            },
          ]}
        />
      </article>
      <DecisionNote
        title="Efficiency is a first-order commercial lever"
        copy="Use an interval load profile next. Without real hourly demand, the workspace will not manufacture monthly or hourly operating charts."
      />
    </>
  );
}
