import { useState } from "react";
import { LoaderCircle, Play, ShieldCheck } from "lucide-react";
import { acceptCanonicalJobResult } from "../operations/canonical-job-result";
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

type Analysis =
  | "facility_plan"
  | "facility_uncertainty"
  | "rolling_facility_plan"
  | "market_qualification"
  | "facility_historical_replay";

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
  const [acceptance, setAcceptance] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setJob(null);
    setAcceptance(null);
    try {
      const raw: unknown = JSON.parse(source);
      let accepted;
      if (analysis === "facility_plan")
        accepted = await startFacilityPlan(schemas.facility_plan.parse(raw));
      else if (analysis === "facility_uncertainty")
        accepted = await startFacilityUncertainty(schemas.facility_uncertainty.parse(raw));
      else if (analysis === "rolling_facility_plan")
        accepted = await startRollingFacilityPlan(schemas.rolling_facility_plan.parse(raw));
      else if (analysis === "market_qualification")
        accepted = await startMarketQualification(schemas.market_qualification.parse(raw));
      else
        accepted = await startFacilityHistoricalReplay(
          schemas.facility_historical_replay.parse(raw),
        );
      const completed = await waitForAnalyticsJob(accepted.job_id);
      setJob(completed);
      if (analysis === "facility_plan" && completed.status === "succeeded") {
        const projected = acceptCanonicalJobResult(completed, schemas.facility_plan.parse(raw));
        setAcceptance(`Replay-valid MILP · ${projected.identity.status === "optimal" ? "optimal" : "feasible incumbent, not proven optimal"} · engine ${projected.identity.engineVersion}. Separate analysis; scenario charts are unchanged.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The canonical analysis could not run");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="data-panel canonical-planning-workbench"
      aria-labelledby="canonical-planning-title"
      aria-busy={busy}
    >
      <div className="section-toolbar">
        <div>
          <p className="context-label">Canonical engine</p>
          <h3 id="canonical-planning-title">Configure analysis</h3>
        </div>
        <span>
          <ShieldCheck aria-hidden="true" /> Read-only
        </span>
      </div>
      <p>
        Choose an analysis and paste its versioned JSON contract. The browser checks the format; the
        canonical engine performs the calculation.
      </p>
      <p>
        Separate analysis only. Results here do not replace the scenario charts in Overview, Compute
        & Workloads or Power & Battery. A successful job is not permission to dispatch.
      </p>
      <div className="canonical-field">
        <label htmlFor="canonical-analysis-kind">Analysis</label>
        <select
          id="canonical-analysis-kind"
          name="analysis"
          disabled={busy}
          value={analysis}
          onChange={(event) => {
            setAnalysis(event.target.value as Analysis);
            setJob(null);
            setError(null);
            setAcceptance(null);
          }}
        >
          <option value="facility_plan">Facility plan</option>
          <option value="facility_uncertainty">Uncertainty assessment</option>
          <option value="rolling_facility_plan">Rolling plan</option>
          <option value="market_qualification">Market qualification and settlement</option>
          <option value="facility_historical_replay">Historical replay and economics</option>
        </select>
      </div>
      <div className="canonical-field">
        <label htmlFor="canonical-request-source">Canonical request JSON</label>
        <textarea
          id="canonical-request-source"
          name="canonicalRequest"
          disabled={busy}
          rows={12}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setJob(null);
            setError(null);
            setAcceptance(null);
          }}
          placeholder={`Paste a reviewed ${analysis.replaceAll("_", " ")} request…`}
          spellCheck={false}
        />
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={busy || !source.trim()}
        onClick={() => void run()}
      >
        {busy ? <LoaderCircle aria-hidden="true" /> : <Play aria-hidden="true" />}
        {busy ? "Running analysis…" : "Validate and run"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {acceptance ? <p role="status">{acceptance}</p> : null}
      {job ? (
        <div className="compact-result" role="status">
          <strong>{job.status}</strong>
          <span>Job {job.id}</span>
          {job.error ? <p>{job.error}</p> : null}
          {job.result_payload ? <pre>{JSON.stringify(job.result_payload, null, 2)}</pre> : null}
        </div>
      ) : null}
    </section>
  );
}
