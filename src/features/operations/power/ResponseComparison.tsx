import type { OperationsOverviewModel } from "../scenario-engine";

import { OperationsDefinitionRow } from "../components";

import { number } from "./presentation";

export function ResponseComparison({ model }: { model: OperationsOverviewModel }) {
  const endingSoc =
    model.intervals.at(-1)?.batterySocPercent ?? model.scenario.battery.initialSocPercent;
  return (
    <article className="power-response-comparison">
      <header>
        <div>
          <p className="context-label">Response Comparison</p>
          <h3>Compare feasible operating responses</h3>
        </div>
        <span>All results simulated</span>
      </header>
      <div>
        {model.summaries.map((summary) => (
          <section
            key={summary.kind}
            className={summary.kind === "battery_workload" ? "selected" : ""}
          >
            <strong>{summary.label}</strong>
            <dl>
              <OperationsDefinitionRow
                label="Limit violations"
                value={summary.violationIntervals}
              />
              <OperationsDefinitionRow
                label="Peak import"
                value={`${number.format(summary.peakDemandMw)} MW`}
              />
              <OperationsDefinitionRow
                label="Ending SOC"
                value={
                  summary.kind === "baseline" ? "Not dispatched" : `${number.format(endingSoc)}%`
                }
              />
              <OperationsDefinitionRow
                label="Workload shifted"
                value={
                  summary.kind === "battery_workload"
                    ? `${number.format(model.recommendation.workloadMwh)} MWh`
                    : "0 MWh"
                }
              />
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}
