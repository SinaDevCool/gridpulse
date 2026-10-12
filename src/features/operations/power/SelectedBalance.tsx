import type { OperationsInterval } from "../scenario-engine";

import { formatOperationsTime } from "../presentation";

import {
type EvidenceMode,
formatOptionalMw,
type HistoricalPoint,
number,
valueOf,
} from "./presentation";

import { EmptyEvidence,EvidencePill,Row } from "./primitives";

export function SelectedBalance({
  selected,
  mode,
  targetMw,
}: {
  selected: Record<string, unknown> | OperationsInterval | HistoricalPoint | null;
  mode: EvidenceMode;
  targetMw: number;
}) {
  return (
    <article className="power-detail-card">
      <header>
        <div>
          <p className="context-label">Selected interval</p>
          <h3>Power balance and provenance</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      {selected ? (
        <dl>
          <Row label="Timestamp" value={formatOperationsTime(String(selected.timestamp), true)} />
          <Row
            label="Facility demand"
            value={formatOptionalMw(valueOf(selected, "facilityDemandMw", "baselineDemandMw"))}
          />
          <Row
            label="Battery power"
            value={
              typeof selected.batteryPowerMw === "number"
                ? `${number.format(selected.batteryPowerMw)} MW`
                : "Unavailable"
            }
          />
          <Row
            label="Grid import"
            value={formatOptionalMw(valueOf(selected, "gridImportMw", "batteryDemandMw"))}
          />
          <Row label="Safety target" value={`${number.format(targetMw)} MW · assumption`} />
          <Row
            label="Balance check"
            value={
              typeof selected.batteryPowerMw === "number"
                ? "Demand − battery = grid import"
                : "Cannot calculate without battery telemetry"
            }
          />
        </dl>
      ) : (
        <EmptyEvidence />
      )}
    </article>
  );
}
