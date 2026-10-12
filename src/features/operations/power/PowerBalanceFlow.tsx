import type { OperationsInterval } from "../scenario-engine";

import { buildPowerBalancePresentation } from "../power-balance";

import { PowerBalanceDiagram } from "../PowerBalanceDiagram";

import { formatOperationsTime } from "../presentation";

import { type EvidenceMode,type HistoricalPoint,valueOf } from "./presentation";

import { EmptyEvidence,EvidencePill } from "./primitives";

export function PowerBalanceFlow({
  selected,
  mode,
  limitMw,
}: {
  selected: Record<string, unknown> | OperationsInterval | HistoricalPoint | null;
  mode: EvidenceMode;
  limitMw: number;
}) {
  const facility = selected ? valueOf(selected, "facilityDemandMw", "baselineDemandMw") : null;
  const grid = selected ? valueOf(selected, "gridImportMw", "batteryDemandMw") : null;
  const battery =
    selected && typeof selected.batteryPowerMw === "number" ? selected.batteryPowerMw : null;
  const gpu =
    mode === "scenario" &&
    selected &&
    "gpuPowerMw" in selected &&
    typeof selected.gpuPowerMw === "number"
      ? selected.gpuPowerMw
      : null;
  const balance =
    facility == null || grid == null
      ? null
      : buildPowerBalancePresentation({
          facilityMw: facility,
          gridMw: grid,
          batteryMw: battery,
          gpuMw: gpu,
        });
  return (
    <article className="power-flow-card">
      <header>
        <div>
          <p className="context-label">
            Selected interval ·{" "}
            {selected && typeof selected.timestamp === "string"
              ? formatOperationsTime(selected.timestamp, true)
              : "Unavailable"}
          </p>
          <h3>Facility Power Balance</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      {balance ? (
        <PowerBalanceDiagram balance={balance} limitMw={limitMw} />
      ) : selected ? (
        <p className="balance-warning" role="status">
          Power balance unavailable: matching battery and facility readings are required. Missing
          values are not assumed to be zero.
        </p>
      ) : (
        <EmptyEvidence />
      )}
      <p className="power-flow-note">
        {mode === "scenario"
          ? "Scenario allocation. Other load includes all consumption not allocated to compute; individual cooling or UPS measurements are not inferred."
          : "Facility demand is derived from aligned net-import and battery readings. Sub-loads are unavailable."}
      </p>
    </article>
  );
}
