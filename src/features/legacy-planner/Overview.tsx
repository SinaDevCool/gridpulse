import { type Dispatch,type SetStateAction } from "react";

import { Activity,ShieldAlert } from "lucide-react";

import { EvidenceLegend,WaterfallChart } from "@/features/data-centre-planner/analytics-charts";

import { type Artifact,type Design,type Project,type View } from "./contracts";

import { DecisionNote,Metric,Title } from "./primitives";

import { fmt } from "./presentation";

export function Overview({
  design,
  project,
  gap,
  artifact,
  go,
}: {
  design: Design;
  project: Project;
  gap: number | null;
  artifact: Artifact | null;
  go: Dispatch<SetStateAction<View>>;
}) {
  return (
    <>
      <Title
        over="Portfolio snapshot"
        title="What requires a decision?"
        copy="Demand, evidence, connection exposure and economic readiness in one concise view."
      />
      <EvidenceLegend />
      <article className="dca-card dca-primary-chart">
        <WaterfallChart
          title="Project demand and entered connection envelope"
          unit="MW"
          items={[
            { label: "Connected IT", value: project.it, color: "#49d3ff", note: "Customer input" },
            {
              label: "Facility peak",
              value: design?.facilityPeakMw ?? null,
              color: "#8b75ff",
              note: "Calculated with PUE",
            },
            {
              label: "Entered firm offer",
              value: project.firm,
              color: "#54d6a6",
              note: "Customer/operator scenario",
            },
            {
              label: "Unresolved gap",
              value: gap,
              color: "#efb743",
              note: "Not available capacity",
            },
          ]}
        />
      </article>
      <div className="dca-metrics">
        <Metric
          label="Facility peak"
          value={design ? `${fmt.format(design.facilityPeakMw)} MW` : "Not calculated"}
          note="Requires IT load and PUE"
        />
        <Metric
          label="Annual energy"
          value={design ? `${fmt.format(design.annualFacilityEnergyGwh)} GWh` : "Not calculated"}
          note="Customer-input scenario"
        />
        <Metric
          label="Connection gap"
          value={gap === null ? "Unknown" : `${fmt.format(gap)} MW`}
          note="Against entered offer only"
        />
        <Metric
          label="Public peer evidence"
          value={artifact ? `${artifact.metadata.record_count} records` : "Unavailable"}
          note="RZReg; not site capacity"
        />
      </div>
      <DecisionNote
        title={
          gap === null
            ? "Connection exposure cannot be evaluated"
            : gap > 0
              ? `${fmt.format(gap)} MW remains above the entered offer`
              : "Entered offer covers the calculated planning peak"
        }
        copy={
          gap === null
            ? "Enter a documented or hypothetical firm-import envelope. The result will remain a scenario until operator confirmation."
            : gap > 0
              ? "Compare time-limited flexibility options, then obtain an hourly operator envelope. Instantaneous power coverage alone is insufficient."
              : "Confirm the offer, operating restrictions, N-1 basis and delivery date with the responsible operator."
        }
      />
      <div className="dca-grid-2">
        <article className="dca-card">
          <header>
            <Activity />
            <div>
              <span>Readiness path</span>
              <h3>Complete evidence before comparison</h3>
            </div>
          </header>
          {(
            [
              ["Energy design", !!design, "energy"],
              ["Peer benchmark", project.it !== null && !!artifact, "benchmark"],
              ["Operator envelope", project.firm !== null, "flexibility"],
              ["Commercial case", project.price !== null, "economics"],
            ] satisfies Array<[string, boolean, View]>
          ).map(([name, ok, target]) => (
            <button
              className="dca-ready"
              key={String(name)}
              type="button"
              onClick={() => go(target)}
            >
              <i className={ok ? "complete" : ""} />
              <span>
                <strong>{name}</strong>
                <small>{ok ? "Evidence present" : "Input required"}</small>
              </span>
              <b>→</b>
            </button>
          ))}
        </article>
        <article className="dca-card dca-callout">
          <ShieldAlert />
          <h3>Available MW remains unknown</h3>
          <p>
            This workspace tests demand and flexibility against an offer you enter. It does not
            infer DSO headroom, approval or an official connection point.
          </p>
        </article>
      </div>
    </>
  );
}
