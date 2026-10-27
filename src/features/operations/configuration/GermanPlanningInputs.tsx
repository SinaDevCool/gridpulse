import { useEffect, useRef, useState } from "react";
import { connectionEnvelopeError, defaultGermanPlanning, germanDayIntervals, parseGermanPriceCsv, type GermanPlanning } from "../german-planning";
import { GermanReportingInputs } from "./GermanReportingInputs";

/** Advanced planning assumptions share the existing form and calculation lifecycle. */
export function GermanPlanningInputs({ value, ceiling, onChange, onValidation }: { value: GermanPlanning; ceiling: number; onChange: (value: GermanPlanning) => void; onValidation?: (error: string) => void }) {
  const current = useRef(value);
  current.current = value;
  const [error, setError] = useState("");
  const [dateText, setDateText] = useState(value.localDate);
  useEffect(() => setDateText(value.localDate), [value.localDate]);
  let dateError = "";
  try { germanDayIntervals(dateText); } catch { dateError = "Select a valid planning date."; }
  const [limitsText, setLimitsText] = useState(value.importLimits.join(" "));
  useEffect(() => setLimitsText(value.importLimits.join(" ")), [value.importLimits]);
  const count = germanDayIntervals(value.localDate).length;
  const limitsError = connectionEnvelopeError(limitsText, count, ceiling);
  const sourceError = (value.prices.length > 0 || limitsText.trim() !== "") && !value.evidence?.source.trim()
    ? "Add a source or contract reference for imported profiles." : "";
  const [reportingError, setReportingError] = useState("");
  useEffect(() => { onValidation?.(value.enabled ? (dateError || limitsError || sourceError || reportingError || error) : ""); },
    [dateError, error, limitsError, sourceError, reportingError, value.enabled, onValidation]);
  function update(next: GermanPlanning) { onChange(next); setError(""); }
  return <details className="ops-evidence-section"><summary>German market & permissions</summary>
    <label className="ops-check"><input type="checkbox" checked={value.enabled}
      onChange={e => update({ ...value, enabled: e.target.checked })} />Use a German local planning day</label>
    {value.enabled ? <>
      <label>Planning date · Europe/Berlin<input type="date" aria-invalid={!!dateError} aria-describedby={dateError ? "german-planning-date-error" : undefined} value={dateText} onChange={e => {
        setDateText(e.target.value);
        try { germanDayIntervals(e.target.value); update({ ...value, localDate: e.target.value, prices: [], importLimits: [] }); }
        catch { /* Preserve invalid draft; dateError blocks submission until corrected. */ }
      }} /></label>
      {dateError ? <small id="german-planning-date-error" role="alert" className="ops-field-error">{dateError}</small> : null}
      <small>{germanDayIntervals(value.localDate).length} × 15-minute intervals · UTC engine timestamps. Changing date clears imported profiles.</small>
      <label>Source / contract reference<input value={value.evidence?.source ?? ""} maxLength={500}
        onChange={e => update({ ...value, evidence: { source: e.target.value, basis: value.evidence?.basis ?? "assumption", reviewedAt: new Date().toISOString() } })} /></label>
      <label>Evidence basis<select value={value.evidence?.basis ?? "assumption"} onChange={e => update({ ...value,
        evidence: { source: value.evidence?.source ?? "", reviewedAt: new Date().toISOString(), basis: e.target.value as NonNullable<GermanPlanning["evidence"]>["basis"] } })}>
        <option value="assumption">Scenario assumption</option><option value="historical_market">Historical market prices</option>
        <option value="supplier_contract">Supplier contract</option><option value="operator_contract">Operator connection contract</option>
      </select></label>
      <label>Interval prices · EUR/MWh<input type="file" accept=".csv,text/csv" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        try { if (file.size > 100_000) throw new Error("Price CSV exceeds 100 kB.");
          const text = await file.text();
          if (current.current !== value) throw new Error("Inputs changed while reading the CSV. Please select it again.");
          update({ ...value, prices: parseGermanPriceCsv(text, germanDayIntervals(value.localDate)) }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid CSV."); }
      }} /></label>
      <small>CSV: start_utc;end_utc;price_eur_per_mwh. {value.prices.length ? `${value.prices.length} records loaded.` : "No imported tariff."} Wholesale prices exclude network charges and taxes.</small>
      <label>Connection envelope · MW in interval order<textarea rows={3} name="connection-envelope" aria-invalid={!!limitsError} aria-describedby="connection-envelope-error" value={limitsText} onChange={e => {
        setLimitsText(e.target.value);
        const text = e.target.value.trim();
        if (text && !/^[\d.\s]+$/.test(text)) { setError("Enter nonnegative MW values separated by spaces."); return; }
        const values = text ? text.split(/\s+/).map(Number) : [];
        if (values.some(v => !Number.isFinite(v) || v < 0)) { setError("Invalid connection limit."); return; }
        update({ ...value, importLimits: values });
      }} /></label>
      <small id="connection-envelope-error" className={limitsError ? "ops-field-error" : undefined}>{limitsError || "Blank uses the facility ceiling."}</small>
      <small>Optional contract limits; blank uses the facility ceiling. Not a connection-capacity offer.</small>
      <label className="ops-check"><input type="checkbox" checked={value.batteryFlexPermitted}
        onChange={e => update({ ...value, batteryFlexPermitted: e.target.checked })} />Battery permitted for flexibility</label>
      <small>Backup reserve and terminal target still apply. A UPS is not assumed to permit market dispatch.</small>
      <GermanReportingInputs value={value.reporting} onChange={reporting => update({ ...value, reporting })} onValidation={setReportingError} />
      <button type="button" onClick={() => { setDateText(defaultGermanPlanning.localDate); update({ ...defaultGermanPlanning }); }}>Reset market assumptions</button>
    </> : null}
    {error || sourceError ? <p role="alert" className="ops-field-error">{error || sourceError}</p> : null}

  </details>;
}
