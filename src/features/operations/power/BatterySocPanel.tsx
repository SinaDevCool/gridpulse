import type { OperationsInterval,OperationsOverviewModel } from "../scenario-engine";

import { durationLabel,type EvidenceMode,type HistoricalPoint,number } from "./presentation";

import { EvidencePill,Row } from "./primitives";

export function BatterySocPanel({
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
  const soc = mode === "scenario" ? selected.batterySocPercent : (observation?.socPercent ?? null);
  const stateOfHealth =
    mode === "scenario"
      ? battery.stateOfHealthPercent
      : (observation?.stateOfHealthPercent ?? null);
  const boundedSoc = Math.max(0, Math.min(100, soc ?? 0));
  const energyAboveReserve =
    mode === "scenario" && soc != null
      ? (((battery.usableEnergyMwh * battery.stateOfHealthPercent) / 100) *
          Math.max(0, soc - battery.minimumSocPercent)) /
        100
      : null;
  return (
    <article className="battery-soc-card">
      <header>
        <div>
          <p className="context-label">Battery reserve</p>
          <h3>State of Charge & Reserve</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <div className="battery-soc-body">
        <div
          className="battery-reserve-gauge"
          role="img"
          aria-label={
            soc == null
              ? "Battery state of charge unavailable"
              : `Battery state of charge ${number.format(soc)} percent`
          }
        >
          <span className="battery-reserve-reading">
            <strong>{soc == null ? "—" : number.format(soc)}</strong>
            <small>{soc == null ? "Unavailable" : "% SOC"}</small>
          </span>
          <div className="battery-reserve-track" aria-hidden="true">
            <i className="battery-reserve-fill" style={{ width: `${boundedSoc}%` }} />
            <i
              className="battery-reserve-protected"
              style={{ width: `${battery.minimumSocPercent}%` }}
            />
            <i
              className="battery-reserve-marker"
              style={{ left: `${battery.minimumSocPercent}%` }}
            />
            <i
              className="battery-reserve-marker maximum"
              style={{ left: `${battery.maximumSocPercent}%` }}
            />
          </div>
          <p className="power-flow-note">Reserve and maximum markers use configured assumptions.</p>
        </div>
        <dl>
          <Row label="Minimum reserve" value={`${number.format(battery.minimumSocPercent)}%`} />
          <Row label="Maximum SOC" value={`${number.format(battery.maximumSocPercent)}%`} />
          <Row
            label="State of health"
            value={stateOfHealth == null ? "Unavailable" : `${number.format(stateOfHealth)}%`}
          />
          <Row
            label="Endurance at selected power"
            value={mode === "scenario" ? durationLabel(model, selected) : "Not derivable"}
          />
          <Row
            label="Energy above reserve"
            value={
              energyAboveReserve == null
                ? "Not derivable"
                : `${number.format(energyAboveReserve)} MWh`
            }
          />
        </dl>
      </div>
      <p className="power-flow-note">
        Endurance includes discharge efficiency and state of health; it is an estimate, not a backup
        guarantee.
      </p>
    </article>
  );
}
