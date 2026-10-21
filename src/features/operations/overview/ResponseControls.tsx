import { useEffect, useState } from "react";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { responseOptions, selectOperatingSummary } from "./select-operating-summary";

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
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
}) {
  const s = selectOperatingSummary(model, selected);
  const scale = Math.max(s.required, Math.max(0, s.battery) + s.workload, 1);
  return (
    <section className="ops-response-breakdown" aria-label="Selected response breakdown">
      <header>
        <strong>At baseline peak · {formatOperationsTime(s.peak.timestamp)}</strong>
        <span>Same-interval contributions · not independent maxima</span>
      </header>
      <div className="ops-contribution-bar" aria-hidden="true">
        <i className="battery" style={{ width: `${(Math.max(0, s.battery) / scale) * 100}%` }} />
        <i className="workload" style={{ width: `${(s.workload / scale) * 100}%` }} />
      </div>
      <dl>
        {[
          ["Required reduction", s.required],
          [s.battery < 0 ? "Battery charging (negative)" : "Battery discharge", s.battery],
          ["Workload reduction", s.workload],
          ["Recovery load", s.recovery],
          ["Net response", s.response],
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
