import type { OperationsInterval,OperationsOverviewModel } from "../scenario-engine";

import { type EvidenceMode,type HistoricalPoint,number } from "./presentation";

import { EvidencePill,Row } from "./primitives";

export function OperatingEnvelope({
  model,
  selected,
  mode,
  selectedHistorical,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
}) {
  const battery = model.scenario.battery;
  const observation = selectedHistorical?.battery;
  return (
    <article className="power-detail-card">
      <header>
        <div>
          <p className="context-label">Operating envelope</p>
          <h3>Battery constraints</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <dl>
        <Row
          label="SOC"
          value={
            mode === "scenario"
              ? `${number.format(selected.batterySocPercent)}%`
              : observation
                ? `${number.format(observation.socPercent)}%`
                : "Unavailable"
          }
        />
        <Row
          label="SOC bounds"
          value={`${number.format(battery.minimumSocPercent)}–${number.format(battery.maximumSocPercent)}%`}
        />
        <Row
          label="Allowed discharge"
          value={
            mode === "scenario"
              ? `${number.format(selected.availableDischargeMw)} MW`
              : observation?.allowedDischargeMw == null
                ? "Unavailable"
                : `${number.format(observation.allowedDischargeMw)} MW`
          }
        />
        <Row
          label="Allowed charge"
          value={
            mode === "scenario"
              ? `${number.format(selected.availableChargeMw)} MW`
              : observation?.allowedChargeMw == null
                ? "Unavailable"
                : `${number.format(observation.allowedChargeMw)} MW`
          }
        />
        <Row
          label="State of health"
          value={
            mode === "scenario"
              ? `${number.format(battery.stateOfHealthPercent)}%`
              : observation?.stateOfHealthPercent == null
                ? "Unavailable"
                : `${number.format(observation.stateOfHealthPercent)}%`
          }
        />
        <Row
          label="Inverter"
          value={
            mode === "scenario"
              ? battery.inverterAvailable
                ? "Available"
                : "Unavailable"
              : (observation?.inverterState ?? "Unavailable")
          }
        />
        <Row
          label="Temperature"
          value={
            observation?.temperatureC == null
              ? mode === "scenario"
                ? "Not modelled"
                : "Unavailable"
              : `${number.format(observation.temperatureC)} °C`
          }
        />
        <Row
          label="Alarms"
          value={observation?.alarms ?? (mode === "scenario" ? "Not modelled" : "Unavailable")}
        />
      </dl>
    </article>
  );
}
