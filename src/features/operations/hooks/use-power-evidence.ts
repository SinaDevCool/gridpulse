import { requestOperationsAssessment } from "@/lib/operations-api";
import { stableOperationsJson } from "@/lib/operations-request";
import { useEffect,useRef,type ChangeEvent } from "react";
import {
parseBatteryCsv,
parseFacilityPowerCsv,
type BatteryObservation,
type FacilityPowerObservation,
} from "../battery-dispatch";
import { buildImportReport } from "../import-report";
import type { EvidenceMode } from "../power/presentation";
import type { OperationsOverviewModel } from "../scenario-engine";
import { useOperationsEvidenceStore } from "./evidence-store";

export function usePowerEvidence(
  model: OperationsOverviewModel,
  onModeChange?: (mode: EvidenceMode) => void,
) {
  const store = useOperationsEvidenceStore();
  const [facilityObservations, setFacilityObservations] = store.facility;
  const [batteryObservations, setBatteryObservations] = store.battery;
  const [message, setMessage] = store.powerMessage;
  const [error, setError] = store.powerError;
  const request = useRef<{ revision: number; controller: AbortController | null }>({
    revision: 0,
    controller: null,
  });
  const inputSignature = stableOperationsJson(model.scenario);
  useEffect(
    () => () => {
      request.current.revision += 1;
      request.current.controller?.abort();
    },
    [inputSignature],
  );

  function beginImport() {
    request.current.controller?.abort();
    const controller = new AbortController();
    const revision = ++request.current.revision;
    request.current.controller = controller;
    return {
      controller,
      isCurrent: () => revision === request.current.revision && !controller.signal.aborted,
    };
  }

  async function verifyEvidence(
    facility: FacilityPowerObservation[],
    battery: BatteryObservation[],
    signal: AbortSignal,
  ) {
    if (facility.length < 4) return null;
    return requestOperationsAssessment(
      {
        kind: "power",
        facilityName: model.scenario.facilityName,
        contractedLimitMw: model.scenario.importLimitMw,
        limitEvidence: "customer_declared",
        facility,
        battery,
        batteryConfiguration:
          model.scenario.battery.usableEnergyMwh > 0
            ? {
                powerMw: model.scenario.battery.maximumPowerMw,
                energyMwh: model.scenario.battery.usableEnergyMwh,
                minimumReservePercent: model.scenario.battery.minimumSocPercent,
                roundTripEfficiency:
                  model.scenario.battery.chargeEfficiency *
                  model.scenario.battery.dischargeEfficiency,
              }
            : null,
      },
      signal,
    );
  }

  async function loadFacility(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const pending = beginImport();
    try {
      const parsed = parseFacilityPowerCsv(await file.text());
      if (!pending.isCurrent()) return;
      const verified = await verifyEvidence(parsed, batteryObservations, pending.controller.signal);
      if (!pending.isCurrent()) return;
      setFacilityObservations(parsed);
      store.importReports[1]((current) => ({
        ...current,
        facility: buildImportReport(
          "facility",
          file.name,
          parsed.map((row) => row.timestamp),
          Boolean(verified),
        ),
      }));
      onModeChange?.("historical");
      setMessage(
        `${parsed.length} facility meter records loaded from ${file.name}${verified ? " and input-validated by the Operations backend (not dispatch-verified)" : ""}.`,
      );
      setError("");
    } catch (caught) {
      if (!pending.isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Could not read facility measurements.");
    }
    event.target.value = "";
  }

  async function loadBattery(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const pending = beginImport();
    try {
      const parsed = parseBatteryCsv(await file.text());
      if (!pending.isCurrent()) return;
      const verified = await verifyEvidence(
        facilityObservations,
        parsed,
        pending.controller.signal,
      );
      if (!pending.isCurrent()) return;
      setBatteryObservations(parsed);
      store.importReports[1]((current) => ({
        ...current,
        battery: buildImportReport(
          "battery",
          file.name,
          parsed.map((row) => row.timestamp),
          Boolean(verified),
        ),
      }));
      onModeChange?.("historical");
      setMessage(
        `${parsed.length} BMS/PCS records loaded from ${file.name}${verified ? " and aligned by the Operations backend" : ""}.`,
      );
      setError("");
    } catch (caught) {
      if (!pending.isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Could not read battery measurements.");
    }
    event.target.value = "";
  }
  return {
    facilityObservations,
    batteryObservations,
    message,
    error,
    setFacilityObservations,
    setBatteryObservations,
    setMessage,
    setError,
    loadFacility,
    loadBattery,
  };
}
