import { useEffect, useState } from "react";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { responseOptions, selectOperatingSummary } from "./select-operating-summary";
import { SignedResponseDiagram } from "./SignedResponseDiagram";

export function ResponseControls({
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (value: OperationsScenarioKind) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="ops-response-selector" role="group" aria-label="Compare response scenarios">
      {responseOptions.map((option) => (
        <button
          type="button"
          key={option.value}
          disabled={!ready}
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ResponseBreakdown({
  model,
  selected,
  timestamp,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  timestamp?: string;
}) {
  const s = selectOperatingSummary(model, selected, timestamp);
  return (
    <section className="ops-response-breakdown" aria-label="Selected response breakdown">
      <header>
        <strong>Inspecting interval · {formatOperationsTime(s.peak.timestamp)}</strong>
        <span>Same-interval contributions · not independent maxima</span>
      </header>
      <SignedResponseDiagram summary={s} />
      <p>
        At this interval: {formatMw(s.target - (s.peak.baselineDemandMw - s.response))} margin to
        safety target · {formatMw(s.limit - (s.peak.baselineDemandMw - s.response))} margin to
        facility limit. Negative margin means exceedance.
      </p>
      <dl>
        {[
          ["Required reduction", s.required],
          ["Target shortfall", s.residual],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatMw(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <small>
        Compare scenarios only. Candidate workloads still require job-level schedule validation.
      </small>
    </section>
  );
}
