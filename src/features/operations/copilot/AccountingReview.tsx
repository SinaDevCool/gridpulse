import { useEffect, useRef, useState } from "react";
import { startFacilityAccounting, waitForAnalyticsJob } from "@/lib/analytics-api";
import { publicMilpEnabled } from "@/lib/public-milp-session";
import { accountingResultSchema, reviewedTariffSchema } from "../../analytics/experiment-contracts";
import type { CanonicalPresentation } from "../canonical-presentation";
import { intervalTariff } from "./interval-tariff";

/** Uses the existing job service; tariff arithmetic stays in the analytical engine. */
export function AccountingReview({ baseline, jobId, enabled }: { baseline: CanonicalPresentation; jobId?: string | null; enabled: boolean }) {
  const [tariff, setTariff] = useState("");
  const [tariffMode, setTariffMode] = useState<"flat" | "interval">("flat");
  const [detailed, setDetailed] = useState(false);
  const [components, setComponents] = useState({ supplier_markup_eur_per_mwh: "0", network_energy_eur_per_mwh: "0",
    capacity_eur_per_kw_year: "0", prior_billing_peak_mw: "0", source: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ReturnType<typeof accountingResultSchema.parse> | null>(null);
  const [knownId, setKnownId] = useState<string | null>(null);
  const submitted = useRef(false);
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!enabled || !jobId) return null;
  if (publicMilpEnabled()) return <p>Fixed-schedule accounting requires the qualified private analysis service. No tariff calculation has been performed.</p>;
  const price = Number(tariff);
  let prices: number[] = [];
  let validationMessage = "";
  try {
    if (!tariff.trim()) throw new Error("Enter the tariff before calculation.");
    prices = tariffMode === "interval" ? intervalTariff(tariff, baseline.points.length) : baseline.points.map(() => price);
    if (!prices.every(Number.isFinite)) throw new Error("Tariff must be finite EUR/MWh.");
  } catch (error) { validationMessage = error instanceof Error ? error.message : "Invalid tariff."; }
  const reviewed = reviewedTariffSchema.safeParse({ ...components,
    supplier_markup_eur_per_mwh: Number(components.supplier_markup_eur_per_mwh),
    network_energy_eur_per_mwh: Number(components.network_energy_eur_per_mwh),
    capacity_eur_per_kw_year: Number(components.capacity_eur_per_kw_year),
    prior_billing_peak_mw: Number(components.prior_billing_peak_mw), reviewed_at: new Date().toISOString() });
  const valid = (!detailed || reviewed.success) && prices.length === baseline.points.length && !validationMessage;
  async function run(resume?: string) {
    if (active.current || !valid || (!resume && submitted.current)) return;
    active.current = true; setBusy(true);
    submitted.current = true;
    const abort = new AbortController(); controller.current = abort;
    try {
      setStatus("Pricing accepted schedule…");
      const id = resume ?? (await startFacilityAccounting({ schema_version: detailed ? "gridpulse-facility-accounting-request-v2" : "gridpulse-facility-accounting-request-v1",
        baseline_job_id: jobId!, baseline_result_fingerprint: baseline.projected.identity.resultFingerprint,
        prices_eur_per_mwh: prices, ...(detailed && reviewed.success ? { tariff: reviewed.data } : {}) })).job_id;
      setKnownId(id);
      const job = await waitForAnalyticsJob(id, undefined, 2500, abort.signal);
      if (abort.signal.aborted) return;
      if (job.status !== "succeeded") throw new Error("Accounting did not complete.");
      const received = accountingResultSchema.parse(job.result_payload);
      if (received.baseline_result_fingerprint !== baseline.projected.identity.resultFingerprint) throw new Error("Accounting identity mismatch.");
      setResult(received); setStatus("Accounting complete.");
    } catch { if (!abort.signal.aborted) setStatus("Accounting unavailable. Check the existing job if known; do not repeat an unknown submission."); }
    finally { active.current = false; if (!abort.signal.aborted) setBusy(false); }
  }
  return <section className="data-panel" aria-label="Fixed-schedule tariff accounting"><h3>Price this schedule</h3>
    <p>{detailed ? "Reviewed contract components; annual capacity liability is shown separately." : "Energy-only estimate."} The schedule remains unchanged; negative prices are supported.</p>
    <label>Price format<select value={tariffMode} disabled={submitted.current} onChange={event => { setTariffMode(event.target.value as "flat" | "interval"); setTariff(""); setConfirmed(false); }}>
      <option value="flat">Flat tariff</option><option value="interval">One price per interval</option></select></label>
    <label>Tariff (EUR/MWh){tariffMode === "flat" ? <input type="number" step="any" value={tariff} disabled={submitted.current}
      onChange={event => { setTariff(event.target.value); setConfirmed(false); }} /> : <textarea value={tariff} disabled={submitted.current} maxLength={10000}
      aria-describedby="interval-price-help" onChange={event => { setTariff(event.target.value); setConfirmed(false); }} />}</label>
    {tariffMode === "interval" ? <small id="interval-price-help">Enter {baseline.points.length} prices in the displayed interval order, separated by commas, spaces or new lines. Use a decimal point.</small> : null}
    {tariff && validationMessage ? <p role="status">{validationMessage}</p> : null}
    <label><input type="checkbox" checked={detailed} disabled={submitted.current} onChange={e => { setDetailed(e.target.checked); setConfirmed(false); }} />Add reviewed supplier and network charges</label>
    {detailed ? <fieldset disabled={submitted.current}><legend>Contract charges</legend>
      {(Object.keys(components) as (keyof typeof components)[]).map(key => <label key={key}>{({ supplier_markup_eur_per_mwh: "Supplier markup - EUR/MWh",
        network_energy_eur_per_mwh: "Network energy - EUR/MWh", capacity_eur_per_kw_year: "Annual capacity - EUR/kW/year",
        prior_billing_peak_mw: "Prior billing peak - MW", source: "Tariff source / contract reference" })[key]}
        <input type={key === "source" ? "text" : "number"} min={0} step="any" value={components[key]}
          onChange={e => { setComponents({ ...components, [key]: e.target.value }); setConfirmed(false); }} /></label>)}
      <small>Capacity is incremental annual liability above the prior billing peak, not a prorated daily cost. Taxes and fixed fees are excluded.</small></fieldset> : null}
    <label><input type="checkbox" checked={confirmed} disabled={!valid || submitted.current} onChange={event => setConfirmed(event.target.checked)} />Confirm this tariff for the full horizon</label>
    <button type="button" disabled={!valid || !confirmed || submitted.current} onClick={() => void run()}>Calculate schedule charges</button>
    <p role="status">{status}</p>
    {knownId && !result ? <button type="button" disabled={busy} onClick={() => void run(knownId)}>Check accounting job</button> : null}
    {result ? <><dl><dt>Plan energy cost</dt><dd>{result.energy_cost_eur.toFixed(2)} EUR</dd><dt>Baseline energy cost</dt><dd>{result.baseline_energy_cost_eur.toFixed(2)} EUR</dd>
      <dt>Baseline minus plan</dt><dd>{result.energy_cost_difference_eur.toFixed(2)} EUR</dd></dl>
      {result.schema_version === "gridpulse-facility-accounting-result-v2" ? <dl>
        <dt>Supplier markup</dt><dd>{result.plan_charges.supplier_markup_eur.toFixed(2)} EUR</dd>
        <dt>Network energy charge</dt><dd>{result.plan_charges.network_energy_eur.toFixed(2)} EUR</dd>
        <dt>Incremental annual capacity liability</dt><dd>{result.plan_charges.incremental_annual_capacity_eur.toFixed(2)} EUR/year</dd>
      </dl> : null}
      <small>Excluded: {result.excluded.join(", ").replaceAll("_", " ")}. This is not a full bill or guaranteed saving.</small>
      <details><summary>Accounting receipt</summary><p>{knownId}</p><p>{result.result_fingerprint}</p><p>{result.engine_version}</p></details></> : null}
  </section>;
}
