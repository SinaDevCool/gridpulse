import { usePowerEvidence } from "../hooks/use-power-evidence";
import { useSharedWorkloadEvidence } from "../hooks/workload-evidence-context";
import { useOperationsEvidenceDataStore } from "../hooks/evidence-store";
import type { OperationsOverviewModel } from "../scenario-engine";

export function EvidenceInputs({
  model,
  onHistorical,
}: {
  model: OperationsOverviewModel;
  onHistorical: () => void;
}) {
  const data = useOperationsEvidenceDataStore();
  const power = usePowerEvidence(model, () => onHistorical());
  const compute = useSharedWorkloadEvidence();
  return (
    <div className="ops-evidence-inputs">
      <p>
        Files are parsed in your browser. Parsed records are sent to the read-only assessment API.
        Imports are not live connections or verified dispatch.
      </p>
      <label>
        Facility meter CSV
        <input type="file" accept=".csv,text/csv" onChange={power.loadFacility} />
      </label>
      <label>
        Battery telemetry CSV
        <input type="file" accept=".csv,text/csv" onChange={power.loadBattery} />
      </label>
      <p role={power.error ? "alert" : "status"}>{power.error || power.message}</p>
      <label>
        Workload CSV
        <input type="file" accept=".csv,text/csv" onChange={compute.importWorkloadFile} />
      </label>
      <label>
        GPU telemetry CSV
        <input type="file" accept=".csv,text/csv" onChange={compute.importTelemetryFile} />
      </label>
      <button type="button" className="secondary-button" onClick={compute.restoreScenario}>
        Restore Scenario Workloads
      </button>
      <p role={compute.error ? "alert" : "status"}>{compute.error || compute.message}</p>
      <ul>
        {Object.values(data.importReports[0]).map((report) =>
          report ? (
            <li key={report.kind}>
              <strong>{report.kind}</strong>: {report.rowCount} records · {report.filename} ·{" "}
              {report.validation.replaceAll("_", " ")}
            </li>
          ) : null,
        )}
      </ul>
      <small>
        Evidence stays in this workspace session. Reloading clears imports. No database save is
        performed.
      </small>
    </div>
  );
}
