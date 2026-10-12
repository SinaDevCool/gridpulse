import { type OperationsOverviewModel,type OperationsScenarioKind } from "../scenario-engine";

import { integer,number } from "./presentation";

export function ScenarioComparison({
  model,
  selected,
  onSelect,
  compact = false,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
  compact?: boolean;
}) {
  return (
    <section
      className={`operations-v2-comparison${compact ? " compact" : ""}`}
      aria-labelledby={`scenario-comparison-${compact ? "compact" : "full"}`}
    >
      <header>
        <div>
          <p className="context-label">Scenario Comparison</p>
          <h3 id={`scenario-comparison-${compact ? "compact" : "full"}`}>
            Compare Operational Responses
          </h3>
        </div>
        <small>All results simulated</small>
      </header>
      <div className="operations-v2-comparison-grid">
        {model.summaries.map((summary) => (
          <button
            type="button"
            key={summary.kind}
            className={selected === summary.kind ? "selected" : ""}
            onClick={() => onSelect(summary.kind)}
            aria-pressed={selected === summary.kind}
          >
            <span>
              <i aria-hidden="true" />
              {summary.label}
            </span>
            <dl>
              <div>
                <dt>Limit Violations</dt>
                <dd>{summary.violationIntervals}</dd>
              </div>
              <div>
                <dt>Peak Demand</dt>
                <dd>{number.format(summary.peakDemandMw)} MW</dd>
              </div>
              {!compact ? (
                <div>
                  <dt>Total Energy</dt>
                  <dd>{number.format(summary.totalEnergyMwh)} MWh</dd>
                </div>
              ) : null}
              <div>
                <dt>GPU-Hours</dt>
                <dd>{integer.format(summary.additionalGpuHours)} h</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </section>
  );
}
