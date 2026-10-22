import { useState } from "react";
import { ChartNoAxesCombined, Gauge, ScanLine } from "lucide-react";
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
      <header className="ops-explorer-heading">
        <h3>Response explorer</h3>
        <span>Power: display window · Recovery: full horizon</span>
      </header>
      <div className="ops-response-selector" role="group" aria-label="Response explorer view">
        {[
          { id: "compare", label: "Compare plans", Icon: ChartNoAxesCombined },
          { id: "interval", label: "Explain selected interval", Icon: ScanLine },
          { id: "headroom", label: "Modeled headroom", Icon: Gauge },
        ].map(({ id, label, Icon }) => (
          <button type="button" key={id} aria-pressed={lens === id} onClick={() => setLens(id)}>
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {lens === "compare" ? (
        <>
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
