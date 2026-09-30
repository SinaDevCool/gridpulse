import { useState } from "react";
import { LoaderCircle, Play, ShieldCheck } from "lucide-react";
import {
  facilityHistoricalReplayRequestSchema,
  facilityPlanRequestSchema,
  facilityUncertaintyRequestSchema,
  marketQualificationRequestSchema,
  rollingFacilityPlanRequestSchema,
} from "./contracts";
import {
  startFacilityHistoricalReplay,
  startFacilityPlan,
  startFacilityUncertainty,
  startMarketQualification,
  startRollingFacilityPlan,
  waitForAnalyticsJob,
  type AnalyticsJob,
} from "@/lib/analytics-api";

type Analysis = "facility_plan" | "facility_uncertainty" | "rolling_facility_plan" | "market_qualification" | "facility_historical_replay";

const schemas = {
  facility_plan: facilityPlanRequestSchema,
  facility_uncertainty: facilityUncertaintyRequestSchema,
  facility_historical_replay: facilityHistoricalReplayRequestSchema,
  rolling_facility_plan: rollingFacilityPlanRequestSchema,
  market_qualification: marketQualificationRequestSchema,
} as const;

export function CanonicalPlanningWorkbench() {
  const [analysis, setAnalysis] = useState<Analysis>("facility_plan");
  const [source, setSource] = useState("");
  const [job, setJob] = useState<AnalyticsJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const raw: unknown = JSON.parse(source);
      let accepted;
      if (analysis === "facility_plan") accepted = await startFacilityPlan(schemas.facility_plan.parse(raw));
      else if (analysis === "facility_uncertainty") accepted = await startFacilityUncertainty(schemas.facility_uncertainty.parse(raw));
      else if (analysis === "rolling_facility_plan") accepted = await startRollingFacilityPlan(schemas.rolling_facility_plan.parse(raw));
      else if (analysis === "market_qualification") accepted = await startMarketQualification(schemas.market_qualification.parse(raw));
      else accepted = await startFacilityHistoricalReplay(schemas.facility_historical_replay.parse(raw));
      setJob(await waitForAnalyticsJob(accepted.job_id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The canonical analysis could not run");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="data-panel" aria-labelledby="canonical-planning-title">
      <div className="section-toolbar"><div><p className="context-label">Canonical engine</p><h2 id="canonical-planning-title">Facility planning workbench</h2></div><span><ShieldCheck aria-hidden="true" /> Fail closed</span></div>
      <p>Submit a versioned contract exported from a project or integration. The browser validates the transport shape; all electrical, workload, uncertainty, replay, and economic calculations run in the canonical GridPulse analytics engine.</p>
      <label>Analysis<select value={analysis} onChange={(event) => { setAnalysis(event.target.value as Analysis); setJob(null); }}><option value="facility_plan">Facility plan</option><option value="facility_uncertainty">Uncertainty assessment</option><option value="rolling_facility_plan">Rolling plan</option><option value="market_qualification">Market qualification and settlement</option><option value="facility_historical_replay">Historical replay and economics</option></select></label>
      <label>Canonical request JSON<textarea rows={12} value={source} onChange={(event) => setSource(event.target.value)} placeholder={`Paste ${analysis.replaceAll("_", " ")} request JSON`} spellCheck={false} /></label>
      <button className="primary-button" type="button" disabled={busy || !source.trim()} onClick={() => void run()}>{busy ? <LoaderCircle aria-hidden="true" /> : <Play aria-hidden="true" />} Validate and run</button>
      {error ? <p role="alert">{error}</p> : null}
      {job ? <div className="compact-result"><strong>{job.status}</strong><span>Job {job.id}</span>{job.error ? <p>{job.error}</p> : null}{job.result_payload ? <pre>{JSON.stringify(job.result_payload, null, 2)}</pre> : null}</div> : null}
    </section>
  );
}
