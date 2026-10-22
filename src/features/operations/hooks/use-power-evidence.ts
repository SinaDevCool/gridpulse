import { requestOperationsAssessment } from "@/lib/operations-api";
import { stableOperationsJson } from "@/lib/operations-request";
import { useEffect, useRef, type ChangeEvent } from "react";
import {
  parseBatteryCsv,
  parseFacilityPowerCsv,
  type BatteryObservation,
  type FacilityPowerObservation,
} from "../battery-dispatch";
import { buildImportReport } from "../import-report";
import type { EvidenceMode } from "../power/presentation";
import type { OperationsOverviewModel } from "../scenario-engine";
import { useOperationsEvidenceDataStore } from "./evidence-store";
import { useQueryClient } from "@tanstack/react-query";
import { assessmentInput, assessmentQueryKey } from "../assessment-input";

export function usePowerEvidence(
  model: OperationsOverviewModel,
  onModeChange?: (mode: EvidenceMode) => void,
) {
  const queryClient = useQueryClient();
  const store = useOperationsEvidenceDataStore();
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
    const input = assessmentInput(model.scenario, {
      facility,
      battery,
      workloads: store.workloads[0],
      telemetry: store.telemetry[0],
    });
    const response = await requestOperationsAssessment(input, signal);
    if (!signal.aborted) queryClient.setQueryData(assessmentQueryKey(input), response);
    return response;
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
      store.dispatchEvidence({
        type: "accept-power",
        facility: parsed,
        kind: "facility",
        message: `${parsed.length} facility meter records loaded from ${file.name}.`,
        report: buildImportReport(
          "facility",
          file.name,
          parsed.map((row) => row.timestamp),
          Boolean(verified),
        ),
      });
      onModeChange?.("historical");
    } catch (caught) {
      if (!pending.isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Could not read facility measurements.");
    } finally {
      event.target.value = "";
    }
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
      store.dispatchEvidence({
        type: "accept-power",
        battery: parsed,
        kind: "battery",
        message: `${parsed.length} BMS/PCS records loaded from ${file.name}.`,
        report: buildImportReport(
          "battery",
          file.name,
          parsed.map((row) => row.timestamp),
          Boolean(verified),
        ),
      });
      onModeChange?.("historical");
    } catch (caught) {
      if (!pending.isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Could not read battery measurements.");
    } finally {
      event.target.value = "";
    }
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
