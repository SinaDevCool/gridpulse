import { Activity, ShieldCheck } from "lucide-react";
import type { FacilityPlanResult } from "@/features/analytics/contracts";

type Envelope = { id: string; name: string; version: number; status: string; mode: string; max_import_mw: number | null };
type Assessment = { feasible?: boolean; required_reduction_mw?: number; delivered_reduction_mw?: number; shortfall_mw?: number; blockers?: string[] };
type Facility = { maximum_grid_import_mw?: number; import_limit_violation_count?: number; points?: Array<{ interval_index: number; grid_import_mw: number; import_limit_violation_mw: number }> };
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function ActivationWorkspace({ plan, envelopes }: { plan: FacilityPlanResult | null; envelopes: Envelope[] }) {
  if (!plan) return <section className="activation-workspace"><article className="workspace-card compact-empty"><Activity aria-hidden="true" /><h2>No canonical facility plan</h2><p>Run a versioned facility plan from the Planner. GridPulse will not infer firm, flexible, activated, or annual capacity from percentages.</p></article></section>;
  const result = plan.result as { status?: string; assessment?: Assessment | null; facility?: Facility; model_fingerprint?: string };
  const assessment = result.assessment;
  const facility = result.facility;
  return (
    <section className="activation-workspace" aria-label="Power Activation study">
      <div className="activation-status-line"><span className="evidence-pill illustrative"><ShieldCheck aria-hidden="true" /> Canonical plan · {plan.truth_class.replaceAll("_", " ")}</span><span>Capacity claim: No · Live dispatch: Not authorized</span></div>
      <div className="activation-kpis">
        <Metric label="Plan status" value={result.status ?? "unknown"} />
        <Metric label="Required reduction" value={assessment?.required_reduction_mw} unit="MW" />
        <Metric label="Delivered reduction" value={assessment?.delivered_reduction_mw} unit="MW" />
        <Metric label="Shortfall" value={assessment?.shortfall_mw} unit="MW" />
        <Metric label="Maximum import" value={facility?.maximum_grid_import_mw} unit="MW" />
      </div>
      <article className={`control-readiness ${assessment?.feasible ? "within_envelope" : "blocked"}`}><header><Activity aria-hidden="true" /><div><p className="context-label">Canonical facility assessment</p><h2>{assessment?.feasible ? "Plan satisfies the modelled requirement" : "Plan remains blocked"}</h2></div><span>SCREENING ONLY</span></header><p>Model fingerprint: <code>{result.model_fingerprint ?? plan.result_fingerprint}</code></p>{assessment?.blockers?.length ? <ul>{assessment.blockers.map((item) => <li key={item}>{item.replaceAll("_", " ")}</li>)}</ul> : null}</article>
      {facility?.points?.length ? <div className="table-scroll"><table className="product-table"><thead><tr><th>Interval</th><th>Grid import</th><th>Limit violation</th></tr></thead><tbody>{facility.points.map((point) => <tr key={point.interval_index}><td>{point.interval_index}</td><td>{fmt.format(point.grid_import_mw)} MW</td><td>{fmt.format(point.import_limit_violation_mw)} MW</td></tr>)}</tbody></table></div> : null}
      {envelopes.length ? <article className="envelope-history"><header><h2>Recorded envelope evidence</h2><span>Shown for provenance; never recalculated here</span></header>{envelopes.map((item) => <div key={item.id}><strong>v{item.version} · {item.name}</strong><span>{item.mode} · {item.status}</span><span>{item.max_import_mw == null ? "—" : `${fmt.format(item.max_import_mw)} MW`}</span></div>)}</article> : null}
    </section>
  );
}

function Metric({ label, value, unit = "" }: { label: string; value: number | string | undefined; unit?: string }) {
  return <article><p>{label}</p><strong>{typeof value === "number" ? fmt.format(value) : value ?? "—"} {unit ? <small>{unit}</small> : null}</strong></article>;
}
