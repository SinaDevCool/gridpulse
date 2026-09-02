import { AlertTriangle, CircleCheck, Gauge, LockKeyhole, RadioTower } from "lucide-react";
import type { ShadowVerificationResult } from "@/features/analytics/contracts";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function OperationsWorkspace({ result }: { result: ShadowVerificationResult | null }) {
  if (!result) {
    return (
      <section className="operations-workspace" aria-label="Power Operations workspace">
        <article className="workspace-card compact-empty">
          <RadioTower aria-hidden="true" />
          <h2>No canonical shadow run</h2>
          <p>Connect a read-only telemetry adapter and run shadow verification. GridPulse will not fabricate an operating curve when observed evidence is unavailable.</p>
        </article>
      </section>
    );
  }
  const { snapshot } = result;
  const points = snapshot.divergence.points;
  const latest = points.at(-1);
  return (
    <section className="operations-workspace" aria-label="Power Operations workspace">
      <div className="operations-mode"><span className="shadow"><RadioTower aria-hidden="true" /> SHADOW · READ ONLY</span><p>Canonical planned-versus-observed verification. No physical command transport exists.</p></div>
      <div className="operations-kpis" aria-label="Current operating metrics">
        <Metric label="Planned import" value={latest?.planned_grid_import_mw} unit="MW" />
        <Metric label="Observed import" value={latest?.observed_grid_import_mw} unit="MW" />
        <Metric label="Required reduction" value={snapshot.required_reduction_mw} unit="MW" warning />
        <Metric label="Delivered reduction" value={snapshot.delivered_reduction_mw} unit="MW" />
      </div>
      <div className="operations-cards">
        <Status icon={<Gauge />} label="Telemetry" value={snapshot.telemetry.accepted ? "Accepted" : "Blocked"} ok={snapshot.telemetry.accepted} />
        <Status icon={result.ready ? <CircleCheck /> : <AlertTriangle />} label="Divergence" value={snapshot.divergence.classification.replaceAll("_", " ")} ok={result.ready} />
        <Status icon={<LockKeyhole />} label="Automatic dispatch" value="Not authorized" ok={false} />
      </div>
      <article className={`control-readiness ${result.ready ? "within_envelope" : "blocked"}`}>
        <header><AlertTriangle aria-hidden="true" /><div><p className="context-label">Canonical verification</p><h2>{result.ready ? "Shadow checks passed" : "Fail-safe blockers active"}</h2></div><span>FAIL CLOSED</span></header>
        <p>Plan fingerprint: <code>{result.input_fingerprint}</code></p>
        {result.blockers.length ? <ul>{result.blockers.map((blocker) => <li key={blocker}>{blocker.replaceAll("_", " ")}</li>)}</ul> : <p>No unresolved telemetry, divergence, or security blockers. Live dispatch remains unauthorized.</p>}
      </article>
    </section>
  );
}

function Metric({ label, value, unit, warning = false }: { label: string; value?: number; unit: string; warning?: boolean }) {
  return <article className={warning ? "warning" : undefined}><span>{label}</span><strong>{value == null ? "—" : number.format(value)} <small>{unit}</small></strong></article>;
}

function Status({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return <article className={ok ? "ok" : "blocked"}><span aria-hidden="true">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></article>;
}
