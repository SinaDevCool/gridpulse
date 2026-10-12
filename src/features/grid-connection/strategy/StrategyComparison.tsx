import { Info } from "lucide-react";
import { strategyPathSummary } from "./presentation";
import type { StrategyControllerContract } from "./controller-contract";
export function StrategyComparison({ model }: { model: StrategyControllerContract }) {
  const {
    busy,
    activeScenarios,
    liveOptions,
    decisionMatrix,
    suggestedScenarios,
    createStandardScenarios,
    preferScenario,
    duplicateScenario,
    archiveScenario,
  } = model;
  return (
    <div className="strategy-card comparison-workspace">
      <div className="candidate-card-heading">
        <div>
          <p className="context-label">Connection strategy comparison</p>
          <h3>Compare the credible routes before operator engagement</h3>
        </div>
        {!activeScenarios.length ? (
          <button onClick={createStandardScenarios} disabled={busy}>
            Create standard strategies
          </button>
        ) : null}
      </div>
      <div className="option-result-grid" aria-label="Modelled connection option results">
        {liveOptions.map((option) => (
          <article className={`option-result-card ${option.operationalStatus}`} key={option.kind}>
            <div>
              <p className="context-label">{option.evidenceStatus.replaceAll("_", " ")}</p>
              <h4>{option.title}</h4>
            </div>
            <strong>{option.operationalStatus.replaceAll("_", " ")}</strong>
            <dl>
              <div>
                <dt>Initial</dt>
                <dd>{option.initialImportMw.toFixed(1)} MW</dd>
              </div>
              <div>
                <dt>Eventual</dt>
                <dd>{option.eventualImportMw.toFixed(1)} MW</dd>
              </div>
              <div>
                <dt>Restricted</dt>
                <dd>
                  {option.analysis ? `${option.analysis.restrictedHours} h` : "Profile required"}
                </dd>
              </div>
              <div>
                <dt>Residual</dt>
                <dd>
                  {option.analysis ? `${option.analysis.residualUnservedMwh} MWh` : "Not tested"}
                </dd>
              </div>
            </dl>
            <details>
              <summary>Commitments and operator questions</summary>
              <b>Customer commitments</b>
              <ul>
                {option.customerCommitments.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <b>Questions for the operator</b>
              <ul>
                {option.operatorQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      <div
        className="strategy-comparison-table"
        role="table"
        aria-label="Connection strategy comparison"
      >
        <div className="comparison-row comparison-header">
          <span>Strategy</span>
          <span>Initial</span>
          <span>Conditional</span>
          <span>Eventual</span>
          <span>Firmness</span>
          <span>Evidence</span>
          <span>Decision</span>
        </div>
        {activeScenarios.length
          ? activeScenarios.map((scenario) => (
              <div
                className={`comparison-row ${scenario.selection_status === "preferred" ? "preferred" : ""}`}
                key={scenario.id}
              >
                <span>
                  <strong>{scenario.name}</strong>
                  <small>{strategyPathSummary(scenario)}</small>
                </span>
                <span>{scenario.max_import_mw ?? "Open"} MW</span>
                <span>{scenario.conditional_import_mw || 0} MW</span>
                <span>{scenario.eventual_import_mw ?? scenario.max_import_mw ?? "Open"} MW</span>
                <span>{scenario.firmness || "Unspecified"}</span>
                <span>{scenario.evidence_readiness || 0}%</span>
                <span>
                  {scenario.selection_status === "preferred" ? (
                    <b>Preferred</b>
                  ) : (
                    <button onClick={() => preferScenario(scenario.id)} disabled={busy}>
                      Select
                    </button>
                  )}
                  <button onClick={() => duplicateScenario(scenario)} disabled={busy}>
                    Duplicate
                  </button>
                  <button onClick={() => archiveScenario(scenario)} disabled={busy}>
                    Archive
                  </button>
                </span>
              </div>
            ))
          : suggestedScenarios.map(([name, capacity, note]) => (
              <div className="comparison-row" key={String(name)}>
                <span>
                  <strong>{name}</strong>
                  <small>{note}</small>
                </span>
                <span>{Number(capacity).toFixed(1)} MW</span>
                <span>Draft</span>
                <span>Draft</span>
                <span>Indicative</span>
                <span>0%</span>
                <span>Not saved</span>
              </div>
            ))}
      </div>
      <div className="decision-matrix" role="table" aria-label="Evidence-gated decision matrix">
        <div className="decision-matrix-row decision-matrix-header" role="row">
          <span>Route</span>
          <span>Evidence</span>
          <span>Operational fit</span>
          <span>Exposure</span>
          <span>Next controlled action</span>
        </div>
        {decisionMatrix.map((row) => (
          <div className="decision-matrix-row" role="row" key={row.kind}>
            <span>
              <strong>{row.title}</strong>
              <small>{row.recommendation.replaceAll("_", " ")}</small>
            </span>
            <span>
              {row.evidenceReadiness}%<small>{row.unresolvedGates} unresolved gates</small>
            </span>
            <span>{row.operationalStatus.replaceAll("_", " ")}</span>
            <span>
              {row.annualExposureEur === null
                ? "Profile required"
                : `€${row.annualExposureEur.toLocaleString("en-GB")}/yr`}
              {row.exposureSensitivity.status === "modelled" ? (
                <small>
                  Range €{row.exposureSensitivity.lowExposureEur?.toLocaleString("en-GB")}–€
                  {row.exposureSensitivity.highExposureEur?.toLocaleString("en-GB")}
                </small>
              ) : null}
            </span>
            <span>{row.nextAction}</span>
          </div>
        ))}
      </div>
      <p className="model-warning">
        <Info />
        All limits are customer-declared or operator-supplied. GridPulse does not infer available
        capacity.
      </p>
    </div>
  );
}
