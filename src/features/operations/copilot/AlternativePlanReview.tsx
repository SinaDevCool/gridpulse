import { publicMilpEnabled } from "@/lib/public-milp-session";
import { experimentFields, experimentRequestSchema, type ExperimentField, type ExperimentRequest } from "../../analytics/experiment-contracts";
import { useEffect, useRef, useState } from "react";
import { useMilpCalculation } from "../hooks/use-milp-calculation";
import type { OperationsScenario } from "../scenario-engine";
import type { CanonicalPresentation } from "../canonical-presentation";
import { buildBriefEvidence, formatBriefFact } from "./brief";
import { fields, alternativeScenario, type Field } from "./alternative-plan";
import { experimentOriginal, type ReviewedProposal } from "./experiment-proposal";

/** Reuses the existing job lifecycle. The accepted baseline is never replaced. */
export function AlternativePlanReview({ scenario, baseline, baselineJobId, onExperiment, enabled, proposal, exactAvailable }: {
  scenario: OperationsScenario; baseline: CanonicalPresentation; baselineJobId?: string | null;
  onExperiment?: (jobId: string) => void; enabled: boolean; proposal?: ReviewedProposal; exactAvailable?: boolean;
}) {
  const calculation = useMilpCalculation();
  const [original] = useState(() => structuredClone(scenario));
  const [mode, setMode] = useState<"alternative" | "frozen_plan">("alternative");
  const [field, setField] = useState<Field>("batteryEnergy");
  const [extraField, setExtraField] = useState<ExperimentField | "">("");
  const [asset, setAsset] = useState("");
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const notified = useRef<string | null>(null);
  const experimentsAvailable = !publicMilpEnabled() && !!baselineJobId && exactAvailable === true;
  useEffect(() => {
    if (calculation.experiment && calculation.jobId && notified.current !== calculation.jobId) {
      notified.current = calculation.jobId; onExperiment?.(calculation.jobId);
    }
  }, [calculation.experiment, calculation.jobId, onExperiment]);
  if (dismissed || (!enabled && !submitted)) return null;
  const scenarioOriginalValue = field === "importLimit" ? original.importLimitMw : field === "batteryEnergy" ? original.battery.usableEnergyMwh : original.battery.maximumPowerMw;
  let proposed: OperationsScenario | null = null;
  try { if (value.trim()) proposed = alternativeScenario(original, field, Number(value)); } catch { /* Show validation before submitting. */ }
  const experimentField: ExperimentField = extraField || (field === "batteryEnergy" ? "battery_energy_mwh" : field === "batteryPower" ? "battery_power_mw" : "import_limit_mw");
  const spec = experimentFields[experimentField];
  const assets = spec.asset === "battery" ? (baseline.request.batteries ?? []).map(b => ({ id: String(b.resource_id) })) :
    spec.asset === "workload" ? baseline.request.workloads.map(job => ({ id: String(job.workload_id) })) : [];
  const selectedAsset = assets.some(item => item.id === asset) ? asset : assets[0]?.id;
  const originalValue = experimentsAvailable ? experimentOriginal(baseline, experimentField, selectedAsset) : scenarioOriginalValue;
  const numeric = Number(value);
  const valid = !!value.trim() && Number.isFinite(numeric) && numeric >= spec.min && numeric <= spec.max &&
    (spec.asset === "none" || !!selectedAsset) &&
    (experimentField !== "battery_unavailable_interval" || Number.isInteger(numeric) && numeric < baseline.points.length) &&
    (experimentField !== "workload_availability_delay_minutes" || Number.isInteger(numeric));
  const useExperiment = experimentsAvailable;
  let experimentRequest: ExperimentRequest | undefined;
  if (useExperiment && valid && baselineJobId) experimentRequest = experimentRequestSchema.parse({
    schema_version: "gridpulse-facility-experiment-request-v1", baseline_job_id: baselineJobId,
    baseline_result_fingerprint: baseline.projected.identity.resultFingerprint,
    cases: [{ case_id: "copilot-reviewed-change", mode, changes: [{ field: experimentField, value: numeric,
      ...(spec.asset !== "none" ? { asset_id: selectedAsset } : {}) }] }],
  });
  if (proposal && experimentsAvailable && proposal.request.baseline_job_id === baselineJobId &&
    proposal.request.baseline_result_fingerprint === baseline.projected.identity.resultFingerprint) experimentRequest = proposal.request;
  const canSubmit = useExperiment ? !!experimentRequest : !proposal && !!proposed && baseline.request.requirement.truth_class === "synthetic_demonstration";
  const stress = calculation.experiment?.cases[0];
  const outcome = calculation.result?.assessment;
  const ids = ["power.plan_peak", "workloads.completed", "workloads.deadlines_met", "battery.minimum_soc", "battery.reserve_protected", "check.terminal"];
  const before = outcome ? buildBriefEvidence(baseline, null).facts : [];
  const after = outcome ? buildBriefEvidence(outcome, calculation.jobId).facts : [];
  return <section className="data-panel ops-chat-alternative" aria-label="Alternative plan review">
    <h3>{useExperiment ? "Test an alternative" : "New synthetic calculation"}</h3><p>Your current plan stays unchanged.</p>
    {!useExperiment ? <small>This creates a new synthetic model from the input panel, not an exact accepted-baseline comparison.</small> : null}
    {proposal ? <section aria-label="Reviewed experiment proposal"><dl>{proposal.changes.map((change, i) => <div key={i}><dt>{change.label}{change.assetId ? ` · ${change.assetId}` : ""}</dt><dd>{change.before ?? "Not applicable"} → {change.after} {change.unit}</dd></div>)}</dl>
      <small>{proposal.preserved.join(" · ")}</small></section> : null}
    {!proposal ? <>
    {experimentsAvailable ? <label className="ops-chat-alternative-field">Analysis<select value={mode} disabled={submitted}
      onChange={event => { setMode(event.target.value as typeof mode); setConfirmed(false); }}>
      <option value="alternative">Find a new schedule for changed conditions</option><option value="frozen_plan">Keep the accepted schedule fixed and test changed conditions</option>
    </select></label> : <small>Fixed-plan stress tests require the qualified experiment service. Re-optimised alternatives remain available.</small>}
    <label className="ops-chat-alternative-field">Change<select value={field} disabled={submitted}
      onChange={event => { setField(event.target.value as Field); setExtraField(""); setConfirmed(false); }}>
      {Object.entries(fields).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
    </select></label>
    {experimentsAvailable ? <label className="ops-chat-alternative-field">Additional engine experiment<select value={extraField} disabled={submitted}
      onChange={event => { setExtraField(event.target.value as typeof extraField); setValue(""); setConfirmed(false); }}>
      <option value="">Use change above</option>{Object.entries(experimentFields).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
    </select></label> : null}
    {extraField && assets.length ? <label>Asset<select value={selectedAsset} disabled={submitted}
      onChange={event => { setAsset(event.target.value); setConfirmed(false); }}>
      {assets.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
    </select></label> : null}
    <label className="ops-chat-alternative-field">New value ({extraField ? spec.unit : fields[field].unit})<input type="number" step="any" value={value} disabled={submitted}
      onChange={event => { setValue(event.target.value); setConfirmed(false); }} /></label>
    {mode === "frozen_plan" ? <p>Accepted commands stay fixed; this does not search for a replacement schedule.</p> : null}
    {extraField ? <p>Review: {spec.label} = {value || "not supplied"} {spec.unit}; asset: {selectedAsset ?? "facility"}.</p> :
      <p>Current: {originalValue} {fields[field].unit}{canSubmit ? ` → proposed: ${numeric} ${fields[field].unit}` : ""}</p>}
    {experimentField === "battery_energy_mwh" && useExperiment ? <small>SOC, reserve and terminal fractions are preserved. Discharge MW stays unchanged.</small> : null}
    {experimentField === "import_limit_mw" && useExperiment ? <small>The submitted margin between import limit and operating target is preserved. This is an assumed model limit, not an amended connection agreement.</small> : null}
    {value && !canSubmit ? <p role="alert">Enter a value compatible with the current model restrictions.</p> : null}
    </> : null}
    {!submitted ? <><label className="ops-chat-alternative-confirm"><input type="checkbox" checked={confirmed} disabled={!canSubmit}
      onChange={event => setConfirmed(event.target.checked)} />Confirm this separate calculation</label>
      <button type="button" className="secondary-button" disabled={!canSubmit || !confirmed} onClick={() => {
        if (!canSubmit || submitted) return; setSubmitted(true); void calculation.run(proposed ?? original, undefined, experimentRequest);
      }}>Calculate alternative</button><button type="button" className="secondary-button" onClick={() => setDismissed(true)}>Cancel alternative</button></> : null}
    {calculation.busy ? <p role="status">Calculating alternative… {calculation.job?.status}</p> : null}
    {calculation.error ? <p role="alert">{calculation.error}</p> : null}
    {submitted && calculation.error && !calculation.jobId ? <p>Submission status is unknown. Do not submit again automatically; check the job service first.</p> : null}
    {submitted && calculation.error && !calculation.jobId && useExperiment ? <button type="button" disabled={calculation.busy}
      onClick={() => void calculation.recoverExperiment(original)}>Check my existing experiment jobs</button> : null}
    {calculation.error && calculation.jobId ? <button type="button" disabled={calculation.busy} onClick={() => {
      if (canSubmit) void calculation.run(proposed ?? original, calculation.jobId!, experimentRequest);
    }}>Check existing calculation</button> : null}
    {stress ? <section aria-label="Experiment result"><h4>{stress.mode === "frozen_plan" ? "Fixed-plan stress result" : "Alternative experiment"}</h4>
      <p>{stress.mode === "frozen_plan" ? "This tests whether the original commands survive the changed conditions." : "A new schedule was sought. This does not establish that the original schedule survives the changed conditions."}</p>
      <p>{stress.status === "unsupported_or_invalid" ? stress.reason : stress.accepted ? "Passed the supplied model checks" : "The tested conditions did not pass"}</p>
      {stress.peak_import_mw != null ? <p>Peak import: {stress.peak_import_mw.toFixed(1)} MW | Above import limit: {stress.above_import_limit_minutes} min</p> : null}
      {stress.remaining_work_hours != null ? <p>Remaining work: {stress.remaining_work_hours.toFixed(2)} work h</p> : null}
      {stress.first_violation_index != null ? <p>First violation: {baseline.points[stress.first_violation_index]?.timestamp ?? "Unknown interval"}</p> : null}
      {stress.violations?.length ? <details><summary>Violations | {stress.violations.length}</summary><ul>{stress.violations.map((v, i) => <li key={i}>{v.code.replaceAll("_", " ")}{v.asset_id ? ` | ${v.asset_id}` : ""}</li>)}</ul></details> : null}
      {stress.metrics && calculation.experiment?.baseline_metrics ? <table aria-label="Replay comparison"><thead><tr><th>Measure</th><th>Accepted plan</th><th>Experiment</th></tr></thead><tbody>
        {([ ["grid_import_mwh", "Grid energy", "MWh"], ["above_target_minutes", "Above safety target", "min"],
          ["minimum_soc_fraction", "Minimum SOC fraction", ""], ["battery_delivered_mwh", "Battery delivery", "MWh"],
          ["battery_equivalent_full_cycles", "Battery cycles", ""], ["deadline_checks_met", "Deadlines met", ""],
          ["rebound_peak_mw", "Rebound peak", "MW"] ] as const).map(([key, label, unit]) => <tr key={key}><th scope="row">{label}</th>
            <td>{calculation.experiment!.baseline_metrics![key]?.toFixed(2) ?? "Unavailable"} {unit}</td>
            <td>{stress.metrics![key]?.toFixed(2) ?? "Unavailable"} {unit}</td></tr>)}
      </tbody></table> : null}
      <small>Assumed conditions, not a reliability probability. Rack temperature, subinterval ramps and measured delivery are not validated.</small>
      <details><summary>Experiment receipt</summary><p>{calculation.experiment?.engine_version}</p><p>{calculation.experiment?.result_fingerprint}</p></details>
    </section> : null}
    {outcome ? <><h4>Accepted model comparison</h4><table><thead><tr><th scope="col">Measure</th><th scope="col">Current</th><th scope="col">Alternative</th></tr></thead>
      <tbody>{ids.map(id => { const a = before.find(fact => fact.id === id), b = after.find(fact => fact.id === id);
        return a && b ? <tr key={id}><th scope="row">{a.label}</th><td>{formatBriefFact(a)}</td><td>{formatBriefFact(b)}</td></tr> : null;
      })}</tbody></table><p>Alternative solver: {outcome.projected.identity.status.replaceAll("_", " ")}. Peak times may differ.</p>
      <details><summary>Alternative identity</summary><p>{calculation.jobId}</p><p>{outcome.projected.identity.resultFingerprint}</p></details></> : null}
  </section>;
}
