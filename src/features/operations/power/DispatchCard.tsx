import { AlertTriangle,CheckCircle2,ShieldCheck } from "lucide-react";

import type { OperationsInterval,OperationsOverviewModel } from "../scenario-engine";

import { type EvidenceMode,type HistoricalPoint,humanConstraint,number } from "./presentation";

import { Row } from "./primitives";

export function DispatchCard({
  model,
  selected,
  mode,
  selectedHistorical,
  feasible,
  requiredMw,
  shortfallMw,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
  feasible: boolean;
  requiredMw: number | null;
  shortfallMw: number | null;
}) {
  const batteryPower =
    mode === "scenario" ? selected.batteryPowerMw : (selectedHistorical?.batteryPowerMw ?? null);
  return (
    <article className="power-dispatch-card">
      <header>
        {feasible ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div>
          <p className="context-label">Selected-interval recommendation</p>
          <h3>
            {mode === "scenario"
              ? feasible
                ? "Feasible in this scenario"
                : "Response is constrained"
              : "Historical evidence review"}
          </h3>
        </div>
      </header>
      <dl>
        <Row
          label="Required response"
          value={requiredMw == null ? "Unavailable" : `${number.format(requiredMw)} MW`}
        />
        <Row
          label="Achievable response"
          value={
            batteryPower == null ? "Unavailable" : `${number.format(Math.max(0, batteryPower))} MW`
          }
        />
        <Row
          label="Shortfall to safety target"
          value={shortfallMw == null ? "Unavailable" : `${number.format(shortfallMw)} MW`}
        />
        <Row
          label="Starting reserve"
          value={`${number.format(model.scenario.battery.minimumSocPercent)}% SOC`}
        />
        <Row
          label="Selected interval SOC"
          value={
            mode === "scenario"
              ? `${number.format(selected.batterySocPercent)}%`
              : selectedHistorical?.socPercent == null
                ? "Unavailable"
                : `${number.format(selectedHistorical.socPercent)}%`
          }
        />
        <Row
          label="Binding constraint"
          value={
            mode === "scenario"
              ? humanConstraint(selected.batteryConstraintCode)
              : "Not inferred from observations"
          }
        />
      </dl>
      <p className="power-readonly">
        <ShieldCheck aria-hidden="true" />
        Advisory output only. An operator or authorized EMS must approve and execute dispatch.
      </p>
    </article>
  );
}
