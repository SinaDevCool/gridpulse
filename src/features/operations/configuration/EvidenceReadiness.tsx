import { useOperationsCapabilities } from "../use-operations-capabilities";
import { useOperationsEvidenceDataStore } from "../hooks/evidence-store";
import { useSharedWorkloadEvidence } from "../hooks/workload-evidence-context";

/** Data origin and live connection are separate states; an uploaded CSV is not a live connector. */
export function EvidenceReadiness() {
  const { data } = useOperationsCapabilities();
  const evidence = useOperationsEvidenceDataStore();
  const { assessment } = useSharedWorkloadEvidence();
  const sources = [
    ["Facility meter", evidence.facility[0].length],
    ["Battery telemetry", evidence.battery[0].length],
    ["Workload records", assessment.source === "scenario" ? 0 : assessment.decisions.length],
    ["GPU telemetry", evidence.telemetry[0].length],
  ] as const;
  return (
    <details className="ops-source-readiness">
      <summary>Evidence & connector readiness</summary>
      <ul className="ops-source-list">
        {sources.map(([label, count]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{count ? `${count} uploaded records` : "Scenario / not supplied"}</strong>
          </li>
        ))}
      </ul>
      <p>
        GPU telemetry field coverage: {assessment.telemetryCompletenessPercent}%. Not a
        facility-wide confidence score.
      </p>
      <p>
        {data?.connectors.some((item) => item.status === "connected")
          ? "Connection status reported by the backend"
          : "No live connectors configured"}
      </p>
      <ul className="ops-source-list">
        {data?.connectors.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <strong>{item.status.replaceAll("_", " ")}</strong><small>Freshness, measurement quality and operating permission require separate evidence.</small>
          </li>
        ))}
      </ul>
      {!data ? <p role="status">Checking connector backend…</p> : null}
      <small>
        Uploads, connector availability and delivered-response verification are distinct. No
        physical dispatch is enabled.
      </small>
    </details>
  );
}
