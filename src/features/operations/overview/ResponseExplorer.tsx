import { useState } from "react";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { OperatingEnvelopeMap, ScenarioDecisionTable } from "../OperationsDecision";
import { PlanObligations } from "./PlanObligations";
import { ResponseBreakdown } from "./ResponseControls";

export function ResponseExplorer({
  model,
  fullModel,
  selected,
  timestamp,
  onSelect,
}: {
  model: OperationsOverviewModel;
  fullModel: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  timestamp?: string;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const [lens, setLens] = useState("compare");
  return (
    <section className="ops-response-explorer" aria-label="Response explorer">
      <h3>Response explorer</h3>
      <p>Compare power outcomes, explain this interval, and check what remains unresolved.</p>
      <div className="ops-response-selector" role="group" aria-label="Response explorer view">
        {[
          ["compare", "Compare plans"],
          ["interval", "Explain selected interval"],
          ["headroom", "Modeled headroom"],
        ].map(([id, label]) => (
          <button type="button" key={id} aria-pressed={lens === id} onClick={() => setLens(id)}>
            {label}
          </button>
        ))}
      </div>
      {lens === "compare" ? (
        <>
          <p>Peaks and duration: assessment window. Recovery: full planning horizon.</p>
          <ScenarioDecisionTable
            model={model}
            fullModel={fullModel}
            selected={selected}
            onSelect={onSelect}
          />
        </>
      ) : null}
      {lens === "interval" ? (
        <ResponseBreakdown model={model} selected={selected} timestamp={timestamp} />
      ) : null}
      {lens === "headroom" ? <OperatingEnvelopeMap model={model} timestamp={timestamp} /> : null}
      <PlanObligations fullModel={fullModel} selected={selected} />
    </section>
  );
}
