import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMw, formatMwh } from "../formatting";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { selectOperatingSummary } from "./select-operating-summary";
import { PeakImportGauge } from "./PeakImportGauge";

export function OperatingSummary({
  model,
  selected,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
}) {
  const s = selectOperatingSummary(model, selected);
  return (
    <section className="ops-operating-summary" aria-label="Operating summary">
      <PeakImportGauge peak={s.summary.peakDemandMw} target={s.target} limit={s.limit}
        maximum={s.gaugeMaximum} caption={`Selected-window peak · ${s.summary.label} · Simulated`} />
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
