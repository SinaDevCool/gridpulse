import { type ChangeEvent } from "react";

import { FileUp } from "lucide-react";

import { OperationsEvidenceBadge } from "../components";

export function EvidenceImport({
  onWorkloads,
  onTelemetry,
  onScenario,
  message,
  error,
}: {
  onWorkloads: (event: ChangeEvent<HTMLInputElement>) => void;
  onTelemetry: (event: ChangeEvent<HTMLInputElement>) => void;
  onScenario: () => void;
  message: string;
  error: string;
}) {
  return (
    <section className="compute-import" aria-labelledby="compute-import-title">
      <header>
        <div>
          <p className="context-label">Real Exported Evidence</p>
          <h3 id="compute-import-title">Load Scheduler and GPU Records</h3>
        </div>
        <OperationsEvidenceBadge kind="measured" label="Browser processed" />
      </header>
      <p className="power-flow-note">
        Files are parsed locally; parsed records are sent to the GridPulse assessment service.
        Imported jobs do not turn the simulated facility timeline into live data.
      </p>
      <div className="compute-import-grid">
        <label>
          <FileUp aria-hidden="true" />
          <strong>Workload CSV</strong>
          <span>Jobs, GPU requests, deadlines and policies</span>
          <input type="file" accept=".csv,text/csv" onChange={onWorkloads} />
        </label>
        <label>
          <FileUp aria-hidden="true" />
          <strong>GPU telemetry CSV</strong>
          <span>DCGM-compatible power and utilisation fields</span>
          <input type="file" accept=".csv,text/csv" onChange={onTelemetry} />
        </label>
        <button type="button" className="secondary-button" onClick={onScenario}>
          Restore Scenario
        </button>
      </div>
      <p
        className={error ? "compute-import-error" : "compute-import-status"}
        role={error ? "alert" : "status"}
      >
        {error || message}
      </p>
    </section>
  );
}
