import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { stableOperationsJson } from "@/lib/operations-request";
import { mapCanonicalComponentInputs } from "../operations/canonical-input-mapping";
import type { OperationsScenario } from "../operations/scenario-engine";
import type { FacilityPlanRequest } from "./contracts";
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
  cancelAnalyticsJob,
  loadAnalyticsJob,
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

export type OperationsPlanningConnection = {
  scenario: OperationsScenario;
  onAccepted: (job: AnalyticsJob, request: FacilityPlanRequest, scenarioIdentity: string) => void;
  onInvalidated: () => void;
};

const calibrationSchema = z.object({ gpuModel: z.string().min(1), activeWatts: z.number().finite().positive(),
  idleWatts: z.number().finite().nonnegative(), shiftablePercent: z.number().finite().min(0).max(100) });

export function CanonicalPlanningWorkbench({ operations }: { operations?: OperationsPlanningConnection }) {
  const [analysis, setAnalysis] = useState<Analysis>("facility_plan");
  const [source, setSource] = useState("");
  const [job, setJob] = useState<AnalyticsJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptance, setAcceptance] = useState<string | null>(null);
  const [calibration, setCalibration] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const controller = useRef<AbortController | null>(null);
  const pendingId = useRef<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function run(resume = false) {
    setBusy(true);
    setError(null);
    setJob(null);
    setAcceptance(null);
    operations?.onInvalidated();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const raw: unknown = JSON.parse(source);
      const scenarioIdentity = operations ? stableOperationsJson(operations.scenario) : "";
      let submitted = analysis === "facility_plan" ? schemas.facility_plan.parse(raw) : null;
      if (operations) {
        if (!reviewed || !submitted) throw new Error("Confirm the reviewed model and GPU/profile calibration first");
        const mapped = mapCanonicalComponentInputs(operations.scenario, submitted, calibrationSchema.parse(JSON.parse(calibration)));
        if (!mapped.request) throw new Error(mapped.blockers.join(" "));
        submitted = mapped.request;
      }
      let accepted;
      if (resume) {
        if (!/^[a-f0-9-]{36}$/i.test(resumeId)) throw new Error("Enter a valid existing job ID");
        const existing = await loadAnalyticsJob(resumeId, abort.signal);
        if (existing.job_type !== "facility_plan") throw new Error("Only facility plans can be resumed here");
        accepted = { job_id: existing.id };
      } else if (analysis === "facility_plan")
        accepted = await startFacilityPlan(submitted!);
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
      pendingId.current = accepted.job_id;
      setResumeId(accepted.job_id);
      const completed = await waitForAnalyticsJob(accepted.job_id, setJob, 2500, abort.signal);
      setJob(completed);
      if (analysis === "facility_plan" && completed.status === "succeeded") {
        const projected = acceptCanonicalJobResult(completed, submitted!);
        operations?.onAccepted(completed, submitted!, scenarioIdentity);
        setAcceptance(`Replay-valid MILP · ${projected.identity.status === "optimal" ? "optimal" : "feasible incumbent, not proven optimal"} · engine ${projected.identity.engineVersion}. ${operations ? "Available across all three Operations tabs." : "Separate analysis; scenario charts are unchanged."}`);
      } else if (completed.status !== "succeeded") {
        throw new Error(completed.error ?? `Facility calculation ${completed.status}; no result accepted`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The canonical analysis could not run");
    } finally {
      setBusy(false);
      pendingId.current = null;
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
        {operations ? "Accepted facility plans populate the MILP view in all three Operations tabs. Input edits invalidate the result. Component accounting is used; PUE is reference-only." : "Separate analysis only. Results here do not replace scenario charts."} A successful job is not permission to dispatch.
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
          {!operations ? <><option value="facility_uncertainty">Uncertainty assessment</option>
          <option value="rolling_facility_plan">Rolling plan</option>
          <option value="market_qualification">Market qualification and settlement</option>
          <option value="facility_historical_replay">Historical replay and economics</option></> : null}
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
            setReviewed(false);
            operations?.onInvalidated();
          }}
          placeholder={`Paste a reviewed ${analysis.replaceAll("_", " ")} request…`}
          spellCheck={false}
        />
      </div>
      {operations ? <div className="canonical-field">
        <label htmlFor="canonical-calibration">Reviewed GPU/profile calibration JSON</label>
        <textarea id="canonical-calibration" rows={3} value={calibration} disabled={busy}
          placeholder={'{"gpuModel":"Reference accelerator","activeWatts":700,"idleWatts":70,"shiftablePercent":18}'}
          onChange={event => { setCalibration(event.target.value); setReviewed(false); operations.onInvalidated(); }} />
        <label><input type="checkbox" checked={reviewed} disabled={busy}
          onChange={event => setReviewed(event.target.checked)} />I have reviewed the job permissions, power profiles, terminal battery target and component model. This is a modelled assessment, not verified dispatch.</label>
      </div> : null}
      <button
        className="primary-button"
        type="button"
        disabled={busy || !source.trim() || Boolean(operations && !reviewed)}
        onClick={() => void run()}
      >
        {busy ? <LoaderCircle aria-hidden="true" /> : <Play aria-hidden="true" />}
        {busy ? "Running analysis…" : "Validate and run"}
      </button>
      {busy ? <button type="button" className="secondary-button" onClick={() => {
        if (pendingId.current) void cancelAnalyticsJob(pendingId.current).catch(reason => setError(String(reason)));
      }}>Request cancellation</button> : null}
      {operations ? <div className="canonical-field">
        <label htmlFor="canonical-resume-id">Existing facility job ID</label>
        <input id="canonical-resume-id" value={resumeId} disabled={busy} onChange={event => setResumeId(event.target.value)} />
        <button type="button" className="secondary-button" disabled={busy || !resumeId || !reviewed || !source}
          onClick={() => void run(true)}>Resume existing job · no new solve</button>
      </div> : null}
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
