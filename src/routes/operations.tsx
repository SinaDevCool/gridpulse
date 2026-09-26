import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, BatteryCharging, Cpu, Database, FileUp, Gauge, ShieldCheck, UploadCloud } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { assessOperations, parseOperationsCsv } from "@/features/operations/analytics";
import { operationsInputSchema, type OperationalMeasurement, type OperationsAssessment } from "@/features/operations/contracts";

type View = "overview" | "power" | "compute" | "battery" | "forecast" | "verification" | "data";
const views: Array<[View, string]> = [["overview", "Overview"], ["power", "Power"], ["compute", "Compute"], ["battery", "Battery"], ["forecast", "Forecast"], ["verification", "Verification"], ["data", "Data health"]];
const operationsSearchSchema = z.object({
  view: z.enum(["overview", "power", "compute", "battery", "forecast", "verification", "data"]).catch("overview").default("overview"),
});

export const Route = createFileRoute("/operations")({
  validateSearch: operationsSearchSchema,
  head: () => ({ meta: [{ title: "Power Operations | GridPulse" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  const [hydrated, setHydrated] = useState(false);
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [measurements, setMeasurements] = useState<OperationalMeasurement[]>([]);
  const [assessment, setAssessment] = useState<OperationsAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState({ facilityName: "", limit: "", limitEvidence: "customer_declared", bessPower: "", bessEnergy: "", reserve: "20" });
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => setHydrated(true), []);

  async function loadFile(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const parsed = parseOperationsCsv(await file.text());
      setMeasurements(parsed); setFileName(file.name); setAssessment(null); setError(null);
    } catch (reason) {
      setMeasurements([]); setAssessment(null);
      setError(reason instanceof Error ? reason.message : "The telemetry file could not be read.");
    }
  }

  function analyse(event: FormEvent) {
    event.preventDefault();
    const bessProvided = Boolean(form.bessPower || form.bessEnergy);
    const parsed = operationsInputSchema.safeParse({
      facilityName: form.facilityName, contractedLimitMw: Number(form.limit),
      limitEvidence: form.limitEvidence, measurements,
      bess: bessProvided ? { powerMw: Number(form.bessPower), energyMwh: Number(form.bessEnergy), minimumReservePercent: Number(form.reserve), roundTripEfficiency: 0.9 } : null,
    });
    if (!parsed.success) {
      setError(`${parsed.error.issues[0]?.message ?? "Required operating evidence is missing."} Check the highlighted inputs and try again.`);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setAssessment(assessOperations(parsed.data)); setError(null);
    void navigate({ search: { view: "overview" }, replace: true });
  }

  const latest = measurements.at(-1);
  return <AppShell><main id="main-content" className="section-page operations-page" data-hydrated={hydrated ? "true" : "false"}>
    <PageHeading eyebrow="Data-centre power operations" title="Run more compute within the power limit" description="Monitor facility import, forecast limit risk and evaluate battery or workload responses using accepted measured data. GridPulse does not issue physical control commands." />
    <div className="operations-boundary"><ShieldCheck aria-hidden="true" /><p><strong>Facility operations—not grid capacity.</strong> Headroom means remaining import below a supplied facility limit. It does not indicate capacity available from the network operator.</p></div>
    <nav className="operations-tabs" aria-label="Power Operations views">{views.map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => void navigate({ search: { view: id }, replace: true })}>{label}</button>)}</nav>
    {!assessment ? <section className="operations-onboarding">
      <article className="operations-intro-card">
        <span className="operations-mode-badge"><Database /> REAL DATA ONLY</span><h2>Connect a measured operating history</h2>
        <p>Upload timestamped whole-facility import. Optional GPU, cooling, battery and shiftable-load fields unlock more context. The file is processed in this browser and is not uploaded.</p>
        <div className="operations-source-grid">
          <Source icon={<Gauge />} title="Facility meter" status={measurements.length ? "Loaded" : "Required"} text="Whole-facility grid import is the authoritative demand signal." />
          <Source icon={<Cpu />} title="NVIDIA DCGM" status={latest?.gpuPowerMw != null ? "Detected" : "Optional"} text="GPU power and utilization; never treated as total facility load." />
          <Source icon={<BatteryCharging />} title="BESS EMS" status={latest?.bessSocPercent != null ? "Detected" : "Optional"} text="State of charge and measured battery power." />
        </div>
      </article>
      <form className="operations-import-card" onSubmit={analyse} noValidate>
        <header><FileUp aria-hidden="true" /><div><span>Historical assessment</span><h2>Load operating evidence</h2></div></header>
        <label>Facility name<input name="facilityName" autoComplete="organization" value={form.facilityName} onChange={(e) => setForm({ ...form, facilityName: e.target.value })} placeholder="Example: Berlin AI Campus…" required /></label>
        <div className="operations-form-row"><label>Contracted import limit (MW)<input name="contractedLimitMw" autoComplete="off" inputMode="decimal" type="number" min="0.001" step="0.001" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} required /></label><label>Limit evidence<select name="limitEvidence" autoComplete="off" value={form.limitEvidence} onChange={(e) => setForm({ ...form, limitEvidence: e.target.value })}><option value="customer_declared">Customer declared</option><option value="contract_reviewed">Contract reviewed</option><option value="operator_confirmed">Operator confirmed</option></select></label></div>
        <details><summary>Optional battery configuration</summary><div className="operations-form-row"><label>Power (MW)<input name="bessPowerMw" autoComplete="off" inputMode="decimal" type="number" min="0" step="0.1" value={form.bessPower} onChange={(e) => setForm({ ...form, bessPower: e.target.value })} /></label><label>Energy (MWh)<input name="bessEnergyMwh" autoComplete="off" inputMode="decimal" type="number" min="0" step="0.1" value={form.bessEnergy} onChange={(e) => setForm({ ...form, bessEnergy: e.target.value })} /></label><label>Backup reserve (%)<input name="minimumReservePercent" autoComplete="off" inputMode="decimal" type="number" min="0" max="100" value={form.reserve} onChange={(e) => setForm({ ...form, reserve: e.target.value })} /></label></div></details>
        <label className="operations-dropzone"><UploadCloud aria-hidden="true" /><strong>{fileName || "Choose telemetry CSV"}</strong><span>Required: timestamp, grid_import_mw</span><small>Optional: gpu_power_mw, it_load_mw, cooling_power_mw, bess_power_mw, bess_soc_percent, shiftable_load_mw</small><input aria-label="Operational CSV" type="file" accept=".csv,text/csv" onInput={loadFile} /></label>
        {measurements.length ? <p className="operations-file-ok">{measurements.length.toLocaleString()} valid measurements loaded · {new Date(measurements[0].timestamp).toLocaleString()} to {new Date(measurements.at(-1)!.timestamp).toLocaleString()}</p> : null}
        {error ? <p ref={errorRef} className="operations-error" role="alert" tabIndex={-1}><AlertTriangle aria-hidden="true" />{error}</p> : null}
        <button className="primary-button" type="submit" disabled={!hydrated}>Analyse Measured History</button>
      </form>
    </section> : <OperationsDashboard assessment={assessment} measurements={measurements} view={view} limit={Number(form.limit)} facilityName={form.facilityName} limitEvidence={form.limitEvidence} onReset={() => { setAssessment(null); setMeasurements([]); setFileName(""); }} />}
  </main></AppShell>;
}

function Source({ icon, title, status, text }: { icon: React.ReactNode; title: string; status: string; text: string }) { return <article><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div><em>{status}</em></article>; }

function OperationsDashboard({ assessment, measurements, view, limit, facilityName, limitEvidence, onReset }: { assessment: OperationsAssessment; measurements: OperationalMeasurement[]; view: View; limit: number; facilityName: string; limitEvidence: string; onReset: () => void }) {
  const chart = useMemo(() => measurements.length > 240 ? measurements.filter((_, index) => index % Math.ceil(measurements.length / 240) === 0) : measurements, [measurements]);
  const observedMinimum = Math.min(limit, ...chart.map((point) => point.gridImportMw));
  const observedMaximum = Math.max(limit, ...chart.map((point) => point.gridImportMw));
  const chartPadding = Math.max((observedMaximum - observedMinimum) * 0.2, observedMaximum * 0.04, 1);
  const chartMinimum = Math.max(0, observedMinimum - chartPadding);
  const chartMaximum = observedMaximum + chartPadding;
  const chartRange = Math.max(1, chartMaximum - chartMinimum);
  const yFor = (value: number) => 220 - ((value - chartMinimum) / chartRange) * 200;
  const path = chart.map((point, index) => `${index ? "L" : "M"}${(index / Math.max(1, chart.length - 1)) * 1000},${yFor(point.gridImportMw)}`).join(" ");
  const importedOptional = { gpu: measurements.some((point) => point.gpuPowerMw != null), cooling: measurements.some((point) => point.coolingPowerMw != null), battery: measurements.some((point) => point.bessSocPercent != null), workload: measurements.some((point) => point.shiftableLoadMw != null) };
  return <section className="operations-dashboard">
    <header className="operations-dashboard-header"><div><span>Historical assessment</span><h2>{facilityName}</h2><p>{new Intl.NumberFormat().format(assessment.sampleCount)} accepted measurements · limit {new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(limit)} MW · {limitEvidence.replaceAll("_", " ")}</p></div><button type="button" className="secondary-button" onClick={onReset}>Load Another Dataset</button></header>
    <div className="operations-kpi-grid"><Kpi label="Latest import" value={`${assessment.currentImportMw} MW`} note="Last measured interval" /><Kpi label="Facility headroom" value={`${assessment.currentHeadroomMw} MW`} note="Below supplied limit—not grid capacity" tone={assessment.currentHeadroomMw < 0 ? "danger" : "good"} /><Kpi label="Measured peak" value={`${assessment.peakImportMw} MW`} note={`${assessment.violationCount} intervals above limit`} tone={assessment.violationCount ? "danger" : "good"} /><Kpi label="Forecast" value={assessment.forecast?.accepted ? `${assessment.forecast.peakMw} MW` : "Unavailable"} note={assessment.forecast?.accepted ? `${assessment.forecast.exceedanceProbabilityPercent}% limit risk` : "No model passed publication gate"} /></div>
    {(view === "overview" || view === "power") ? <div className="operations-main-grid"><article className="operations-chart-card"><header><div><span>Measured facility import</span><h3>Power Envelope</h3></div><strong>{assessment.dataCompletenessPercent}% complete</strong></header><div className="operations-chart-frame"><span className="operations-chart-max">{formatMw(chartMaximum)}</span><span className="operations-chart-min">{formatMw(chartMinimum)}</span><svg viewBox="0 0 1000 240" role="img" aria-label="Measured facility import compared with contracted limit"><line x1="0" x2="1000" y1={yFor(limit)} y2={yFor(limit)} className="limit-line"/><path d={path} className="import-line" /></svg><div className="operations-chart-range"><time dateTime={measurements[0].timestamp}>{formatTimestamp(measurements[0].timestamp)}</time><time dateTime={measurements.at(-1)!.timestamp}>{formatTimestamp(measurements.at(-1)!.timestamp)}</time></div></div><footer><span><i className="observed"/>Observed import</span><span><i className="limit"/>Contracted limit</span></footer></article><RiskCard assessment={assessment} /></div> : null}
    {view === "compute" ? <EvidencePanel icon={<Cpu />} title="Compute intelligence" available={importedOptional.gpu || importedOptional.workload} text="GPU power and scheduler flexibility must be present before GridPulse can quantify compute-hours enabled or workload delay." details={[`GPU power: ${importedOptional.gpu ? "available" : "not supplied"}`, `Shiftable workload: ${importedOptional.workload ? "available" : "not supplied"}`]} /> : null}
    {view === "battery" ? <EvidencePanel icon={<BatteryCharging />} title="Battery intelligence" available={importedOptional.battery} text="Battery recommendations require measured state of charge plus declared power, energy and backup-reserve limits." details={[`BESS telemetry: ${importedOptional.battery ? "available" : "not supplied"}`, `Recommended discharge: ${assessment.recommendation?.bessDischargeMw ?? 0} MW`]} /> : null}
    {view === "forecast" ? <ForecastPanel assessment={assessment} /> : null}
    {view === "verification" ? <EvidencePanel icon={<ShieldCheck />} title="Shadow verification" available={false} text="No operational recommendation has been executed or observed in this historical browser session. Live verification remains unavailable until timestamped outcome telemetry is connected." details={["Automatic dispatch: not authorized", "Physical commands: none"]} /> : null}
    {view === "data" ? <div className="operations-data-grid"><Kpi label="Measurements" value={new Intl.NumberFormat().format(assessment.sampleCount)} note={`${assessment.intervalMinutes ?? "Unknown"} minute median interval`} /><Kpi label="Completeness" value={`${assessment.dataCompletenessPercent}%`} note="Based on the median interval" /><Kpi label="GPU power" value={importedOptional.gpu ? "Present" : "Missing"} note="NVIDIA DCGM-compatible field" /><Kpi label="Cooling power" value={importedOptional.cooling ? "Present" : "Missing"} note="Optional facility context" /><Kpi label="BESS state" value={importedOptional.battery ? "Present" : "Missing"} note="Required for battery control" /><Kpi label="Workload flexibility" value={importedOptional.workload ? "Present" : "Missing"} note="Required for job shifting" /></div> : null}
  </section>;
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "danger" }) { return <article className={`operations-kpi ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function RiskCard({ assessment }: { assessment: OperationsAssessment }) { const r = assessment.recommendation; return <article className="operations-action-card"><span>Operational response</span><h3>{r ? r.feasible ? "Response available" : "Residual risk remains" : "No response required"}</h3>{r ? <dl><div><dt>Required reduction</dt><dd>{r.requiredReductionMw} MW</dd></div><div><dt>Battery</dt><dd>{r.bessDischargeMw} MW</dd></div><div><dt>Workload shift</dt><dd>{r.workloadShiftMw} MW</dd></div><div><dt>Expected import</dt><dd>{r.expectedImportMw} MW</dd></div></dl> : <p>The accepted dataset does not indicate a reduction requirement.</p>}<small>Historical analytical recommendation only · no command was issued</small></article>; }
function ForecastPanel({ assessment }: { assessment: OperationsAssessment }) { const forecast = assessment.forecast; return <article className="operations-evidence-panel"><Activity /><div><span>Model publication gate</span><h2>{forecast?.accepted ? "Accepted historical baseline" : "No accepted forecast"}</h2><p>{forecast?.reason ?? "At least 24 accepted intervals are required before a baseline can be evaluated."}</p>{forecast ? <dl><div><dt>Candidate</dt><dd>{forecast.method.replaceAll("_", " ")}</dd></div><div><dt>MAE</dt><dd>{forecast.maeMw} MW</dd></div><div><dt>Persistence MAE</dt><dd>{forecast.baselineMaeMw} MW</dd></div><div><dt>Limit risk</dt><dd>{forecast.accepted ? `${forecast.exceedanceProbabilityPercent}%` : "Not published"}</dd></div></dl> : null}</div></article>; }
function EvidencePanel({ icon, title, available, text, details }: { icon: React.ReactNode; title: string; available: boolean; text: string; details: string[] }) { return <article className="operations-evidence-panel"><span>{icon}</span><div><em>{available ? "Evidence available" : "Integration required"}</em><h2>{title}</h2><p>{text}</p><ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul></div></article>; }

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMw(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} MW`;
}
