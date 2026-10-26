import { useEffect, useRef, useState } from "react";
import { startFacilityAccounting, waitForAnalyticsJob } from "@/lib/analytics-api";
import { publicMilpEnabled } from "@/lib/public-milp-session";
import { accountingResultSchema } from "../../analytics/experiment-contracts";
import type { CanonicalPresentation } from "../canonical-presentation";

/** Uses the existing job service; tariff arithmetic stays in the analytical engine. */
export function AccountingReview({ baseline, jobId, enabled }: { baseline: CanonicalPresentation; jobId?: string | null; enabled: boolean }) {
  const [tariff, setTariff] = useState("");
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
  const valid = !!tariff.trim() && Number.isFinite(price);
  async function run(resume?: string) {
    if (active.current || !valid || (!resume && submitted.current)) return;
    active.current = true; setBusy(true);
    submitted.current = true;
    const abort = new AbortController(); controller.current = abort;
    try {
      setStatus("Pricing accepted schedule…");
      const id = resume ?? (await startFacilityAccounting({ schema_version: "gridpulse-facility-accounting-request-v1",
        baseline_job_id: jobId!, baseline_result_fingerprint: baseline.projected.identity.resultFingerprint,
        prices_eur_per_mwh: baseline.points.map(() => price) })).job_id;
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
    <p>Energy-only estimate at a flat tariff. The schedule remains unchanged.</p>
    <label>Tariff (EUR/MWh)<input type="number" step="any" value={tariff} disabled={submitted.current}
      onChange={event => { setTariff(event.target.value); setConfirmed(false); }} /></label>
    <label><input type="checkbox" checked={confirmed} disabled={!valid || submitted.current} onChange={event => setConfirmed(event.target.checked)} />Confirm this tariff for the full horizon</label>
    <button type="button" disabled={!valid || !confirmed || submitted.current} onClick={() => void run()}>Calculate energy cost</button>
    <p role="status">{status}</p>
    {knownId && !result ? <button type="button" disabled={busy} onClick={() => void run(knownId)}>Check accounting job</button> : null}
    {result ? <><dl><dt>Plan energy cost</dt><dd>{result.energy_cost_eur.toFixed(2)} EUR</dd><dt>Baseline energy cost</dt><dd>{result.baseline_energy_cost_eur.toFixed(2)} EUR</dd>
      <dt>Baseline minus plan</dt><dd>{result.energy_cost_difference_eur.toFixed(2)} EUR</dd></dl>
      <small>Excluded: {result.excluded.join(", ").replaceAll("_", " ")}. This is not a full bill or guaranteed saving.</small>
      <details><summary>Accounting receipt</summary><p>{knownId}</p><p>{result.result_fingerprint}</p><p>{result.engine_version}</p></details></> : null}
  </section>;
}
