import { useEffect, useState } from "react";
import { assessGermanEvidence, germanReportingContextSchema, type GermanReportingContext } from "../german-evidence";

const dateFields = { commissionedAt: "Commissioning date", periodStart: "Reporting year start", periodEnd: "Reporting year end (exclusive)", rulesReviewedAt: "Legal applicability reviewed" } as const;
const checks = { publicOperator: "Public operator", facilityBoundaryReviewed: "Measurement boundaries reviewed", renewableEvidenceReviewed: "Renewable electricity evidence reviewed", heatEvidenceReviewed: "Heat reuse evidence reviewed", managementSystemEvidenceReviewed: "Management system evidence reviewed" } as const;
const blank = { commissionedAt: "", periodStart: "", periodEnd: "", rulesReviewedAt: "", nonRedundantConnectionKw: "", installedItKw: "", publicOperator: false, facilityBoundaryReviewed: false, renewableEvidenceReviewed: false, heatEvidenceReviewed: false, managementSystemEvidenceReviewed: false };
const draftOf = (value?: GermanReportingContext) => value ? { ...value, nonRedundantConnectionKw: String(value.nonRedundantConnectionKw), installedItKw: String(value.installedItKw) } : { ...blank };

/** Reporting evidence is explicitly saved; no commissioning dates or capacities are invented. */
export function GermanReportingInputs({ value, onChange, onValidation }: { value?: GermanReportingContext; onChange: (value?: GermanReportingContext) => void; onValidation: (error: string) => void }) {
  const [draft, setDraft] = useState(() => draftOf(value));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(draftOf(value)); setDirty(false); setError(""); }, [value]);
  useEffect(() => { onValidation(dirty ? "Save or cancel the reporting review before optimising." : ""); return () => onValidation(""); }, [dirty, onValidation]);
  const assessment = assessGermanEvidence(value);
  function save() {
    const parsed = germanReportingContextSchema.safeParse({ ...draft, installedItKw: draft.installedItKw === "" ? null : Number(draft.installedItKw), nonRedundantConnectionKw: draft.nonRedundantConnectionKw === "" ? null : Number(draft.nonRedundantConnectionKw) });
    if (!parsed.success) { setError("Enter all dates and both capacities. Use zero only for a confirmed zero capacity."); return; }
    onChange(parsed.data); setDirty(false); setError("");
  }
  return <details><summary>Reporting evidence · optional</summary>
    <small>Context for evidence review; does not certify compliance or change dispatch.</small>
    {Object.entries(dateFields).map(([field, label]) => { const key = field as keyof typeof dateFields; return <label key={key}>{label}
      <input type="date" name={`reporting-${key}`} value={draft[key].slice(0, 10)} onChange={e => { setDraft({ ...draft, [key]: e.target.value ? `${e.target.value}T00:00:00Z` : "" }); setDirty(true); }} /></label>; })}
    {(["nonRedundantConnectionKw", "installedItKw"] as const).map(key => <label key={key}>{key === "installedItKw" ? "Installed IT power · kW" : "Non-redundant connection · kW"}
      <input type="number" name={`reporting-${key}`} min={0} step="any" inputMode="decimal" value={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setDirty(true); }} /></label>)}
    {Object.entries(checks).map(([field, label]) => { const key = field as keyof typeof checks; return <label key={key} className="ops-check"><input type="checkbox" checked={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.checked }); setDirty(true); }} />{label}</label>; })}
    {error ? <p role="alert" className="ops-field-error">{error}</p> : null}
    <button type="button" disabled={!dirty} onClick={save}>Save review</button>{" "}
    <button type="button" disabled={!dirty} onClick={() => { setDraft(draftOf(value)); setDirty(false); setError(""); }}>Cancel edits</button>
    {value ? <><p role="status">{assessment.missing.length} evidence gaps · compliance not certified</p>
      <details><summary>Review evidence gaps</summary><ul>{assessment.missing.map(item => <li key={item}>{item}</li>)}</ul><small>{assessment.warning}</small></details>
      <button type="button" onClick={() => onChange(undefined)}>Remove review</button></> : null}
    <p><a href={assessment.sources[0]} target="_blank" rel="noreferrer">EnEfG reference</a></p>
  </details>;
}
