import type { OperationsInterval, OperationsOverviewModel } from "../scenario-engine";

import { selectedReserveEnergy } from "./select-battery-workspace";

import { durationLabel, type EvidenceMode, type HistoricalPoint, number } from "./presentation";

import { EvidencePill, Row } from "./primitives";

export function BatterySocPanel({
  model,
  selected,
  mode,
  selectedHistorical,
  protectedSocPercent,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
  protectedSocPercent: number;
}) {
  const battery = model.scenario.battery;
  const observation = selectedHistorical?.battery;
  const soc = mode === "scenario" ? selected.batterySocPercent : (observation?.socPercent ?? null);
  const boundedSoc = Math.max(0, Math.min(100, soc ?? 0));
  const energyAboveReserve =
    mode === "scenario" && soc != null ? selectedReserveEnergy(model, selected) : null;
  const protectedSoc = protectedSocPercent;
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
              style={{ width: `${Math.min(100, protectedSoc)}%` }}
            />
            <i
              className="battery-reserve-marker"
              style={{ left: `${Math.min(100, protectedSoc)}%` }}
            />
            <i
              className="battery-reserve-marker maximum"
              style={{ left: `${battery.maximumSocPercent}%` }}
            />
          </div>
          <p className="power-flow-note">
            {mode === "scenario" ? "End-of-interval SOC. " : "Observed SOC. "}Reserve and maximum
            markers use configured assumptions; backup energy is additionally protected when
            configured.
          </p>
        </div>
        <dl>
          <Row label="Minimum SOC floor" value={`${number.format(battery.minimumSocPercent)}%`} />
          <Row
            label="Effective protected reserve"
            value={`${number.format(protectedSoc)}% · assumption`}
          />
          {protectedSoc > battery.maximumSocPercent ? (
            <p role="status">Required reserve exceeds the configured usable SOC range.</p>
          ) : null}
          {mode === "scenario" ? (
            <Row
              label="Start → end SOC"
              value={`${selected.batteryStartingSocPercent == null ? "Unavailable" : number.format(selected.batteryStartingSocPercent)} → ${number.format(selected.batterySocPercent)}%`}
            />
          ) : null}
          <Row
            label="Endurance at selected power"
            value={mode === "scenario" ? durationLabel(model, selected) : "Not derivable"}
          />
          <Row
            label="Energy above reserve · DC"
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
