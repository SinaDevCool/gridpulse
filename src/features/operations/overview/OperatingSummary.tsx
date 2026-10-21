import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMw, formatMwh } from "../formatting";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { selectOperatingSummary } from "./select-operating-summary";

export function OperatingSummary({
  model,
  selected,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
}) {
  const s = selectOperatingSummary(model, selected);
  const at = (value: number) => {
    const angle = Math.PI * (1 - value / s.gaugeMaximum);
    return { x: 140 + 108 * Math.cos(angle), y: 128 - 108 * Math.sin(angle) };
  };
  return (
    <section className="ops-operating-summary" aria-label="Operating summary">
      <div
        className="ops-import-gauge"
        role="meter"
        aria-label="Peak import after response"
        aria-valuemin={0}
        aria-valuemax={s.gaugeMaximum}
        aria-valuenow={s.summary.peakDemandMw}
        aria-valuetext={`${formatMw(s.summary.peakDemandMw)}; safety target ${formatMw(s.target)}; facility limit ${formatMw(s.limit)}; scenario peak, not live`}
      >
        <svg viewBox="0 0 280 155" aria-hidden="true">
          <path d="M32 128 A108 108 0 0 1 248 128" pathLength="100" className="ops-gauge-track" />
          <path
            d="M32 128 A108 108 0 0 1 248 128"
            pathLength="100"
            className={`ops-gauge-value ${s.powerMet ? "" : "over"}`}
            strokeDasharray={`${(100 * s.summary.peakDemandMw) / s.gaugeMaximum} 100`}
          />
          {[
            { value: s.target, tone: "target" },
            { value: s.limit, tone: "limit" },
          ].map(({ value, tone }) => (
            <circle
              key={tone}
              cx={at(value).x}
              cy={at(value).y}
              r="5"
              className={`ops-gauge-marker ${tone}`}
            />
          ))}
          <text x="140" y="103" textAnchor="middle" className="ops-gauge-number">
            {formatMw(s.summary.peakDemandMw)}
          </text>
          <text x="140" y="126" textAnchor="middle">
            Peak import after response
          </text>
          <text x="26" y="152">
            0
          </text>
          <text x="254" y="152" textAnchor="end">
            {formatMw(s.gaugeMaximum)}
          </text>
        </svg>
        <div className="ops-gauge-key">
          <span>
            Target <b>{formatMw(s.target)}</b>
          </span>
          <span>
            Limit <b>{formatMw(s.limit)}</b>
          </span>
        </div>
        <small>Selected-window peak · {s.summary.label} · Simulated</small>
      </div>
      <div className="ops-headroom-summary">
        <p className="context-label">Safety margin</p>
        <strong>{formatMw(s.headroom)}</strong>
        <span>
          {s.headroom < -0.01 ? "Shortfall to safety target" : "Headroom to safety target"}
        </span>
        <div className="ops-headroom-track" aria-hidden="true">
          <i
            className={s.headroom < 0 ? "negative" : "positive"}
            style={{ width: `${Math.min(50, (Math.abs(s.headroom) / s.gaugeMaximum) * 100)}%` }}
          />
        </div>
        <p>
          {formatMw(Math.abs(s.limitHeadroom))} {s.limitHeadroom < 0 ? "above" : "below"} facility
          limit
        </p>
      </div>
      <div
        className={`ops-plan-status ${s.powerMet && s.recoveryMet && s.summary.feasible ? "clear" : "attention"}`}
      >
        <p className="context-label">Plan status · Full-horizon recovery</p>
        <h3>{s.powerMet ? "Power target met" : "Power target not met"}</h3>
        <p>
          {s.powerMet && s.recoveryMet && s.summary.feasible ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
          {!s.recoveryMet
            ? `${formatMwh(s.summary.unresolvedWorkMwh)} of deferred work remains unrecovered`
            : !s.summary.feasible
              ? "Reserve or recovery constraints remain unresolved"
              : selected === "workload" || selected === "battery_workload"
                ? "Aggregate recovery accounted for; job validation required"
                : "No workload recovery obligation"}
        </p>
        <a
          href="#operations-recovery"
          onClick={() => {
            const node = document.getElementById("operations-recovery");
            if (node instanceof HTMLDetailsElement) node.open = true;
            node?.focus();
          }}
        >
          Review recovery & assumptions
        </a>
        <small>Scenario assessment only. No equipment commands.</small>
      </div>
    </section>
  );
}
