import { analysisSummary } from "./analysis-summary";
import { useEffect, useId, useRef, useState } from "react";
import { publicMilpEnabled } from "../../../lib/public-milp-session";
import {
  listAnalyticsJobs,
  startChronologicalShadow,
  startFacilityUncertainty,
  waitForAnalyticsJob,
} from "../../../lib/analytics-api";
import { stableOperationsJson } from "../../../lib/operations-request";
import { facilityUncertaintyRequestSchema } from "../../analytics/contracts";
import {
  chronologicalShadowRequestSchema,
  chronologicalShadowResultSchema,
  uncertaintyAnalysisResultSchema,
} from "../../analytics/investigation-contracts";
import { matchingReviewedAnalysisJobs } from "../hooks/experiment-lifecycle";
import type { CanonicalPresentation } from "../canonical-presentation";

function usePrivateAnalysis(baseline: CanonicalPresentation) {
  const [mode, setMode] = useState("independent_scenario_benchmark");
  const [temperature, setTemperature] = useState("");
  const [temperatureMax, setTemperatureMax] = useState("");
  const [generationMax, setGenerationMax] = useState("0");
  const [generationFactor, setGenerationFactor] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const frozen = useRef<Record<string, unknown> | null>(null);
  const jobId = useRef<string | null>(null);
  const abort = useRef(new AbortController());
  useEffect(() => {
    abort.current = new AbortController();
    const controller = abort.current;
    return () => controller.abort();
  }, []);
  const jobType =
    mode === "chronological" ? "rolling_facility_plan" : "facility_uncertainty";
  const valid =
    [temperature, temperatureMax, generationMax].every(
      (v) => v.trim() !== "" && Number.isFinite(Number(v)),
    ) &&
    Number(temperature) <= Number(temperatureMax) &&
    Number(generationMax) >= 0;
  const baselineBudget = Number(
    baseline.request.policy.solver_time_limit_seconds,
  );
  const reviewedPlan = {
    ...baseline.request,
    policy: {
      ...baseline.request.policy,
      solver_time_limit_seconds:
        Number.isFinite(baselineBudget) && baselineBudget > 0
          ? Math.min(baselineBudget, 30)
          : 30,
    },
  };
  const compile = () =>
    mode === "chronological"
      ? chronologicalShadowRequestSchema.parse({
          schema_version: "gridpulse-chronological-shadow-request-v1",
          facility_plan: reviewedPlan,
          windows: [
            baseline.points[0],
            baseline.points[Math.floor(baseline.points.length / 2)],
          ].map((point, index) => ({
            cutoff: point.timestamp,
            available_at: point.timestamp,
            changes:
              index === 0
                ? []
                : [
                    {
                      field: "generation_multiplier",
                      value: Number(generationFactor),
                    },
                  ],
          })),
        })
      : facilityUncertaintyRequestSchema.parse({
          schema_version: "gridpulse-facility-uncertainty-request-v1",
          facility_plan: reviewedPlan,
          bounds: {
            temperature_min_c: Number(temperature),
            temperature_max_c: Number(temperatureMax),
            onsite_generation_min_mw: 0,
            onsite_generation_max_mw: Number(generationMax),
          },
          scenario_count: 2,
          seed: 0,
          risk_policy: "chance_constrained",
          confidence: 0.9,
          evaluation_method: mode,
        });
  async function run(recover: boolean) {
    if (
      busy ||
      abort.current.signal.aborted ||
      (!recover && (frozen.current || !confirmed))
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      if (!recover) {
        frozen.current = structuredClone(compile());
        setSubmitted(true);
        jobId.current = (
          mode === "chronological"
            ? await startChronologicalShadow(
                chronologicalShadowRequestSchema.parse(frozen.current),
              )
            : await startFacilityUncertainty(
                facilityUncertaintyRequestSchema.parse(frozen.current),
              )
        ).job_id;
      } else if (!jobId.current && frozen.current) {
        const matches = matchingReviewedAnalysisJobs(
          await listAnalyticsJobs(),
          frozen.current,
          jobType,
        );
        if (matches.length !== 1)
          throw new Error(
            "No unique matching owned job found. No new job was submitted.",
          );
        jobId.current = matches[0].id;
      }
      if (!jobId.current || !frozen.current)
        throw new Error(
          "Submission outcome unknown. Recover the owned job; do not resubmit.",
        );
      const job = await waitForAnalyticsJob(
        jobId.current,
        undefined,
        2000,
        abort.current.signal,
      );
      if (
        job.id !== jobId.current ||
        job.job_type !== jobType ||
        stableOperationsJson(job.input_payload) !==
          stableOperationsJson(frozen.current)
      )
        throw new Error("Reviewed analysis identity mismatch.");
      if (job.status !== "succeeded")
        throw new Error(job.error ?? `Analysis ${job.status}`);
      const accepted =
        mode === "chronological"
          ? chronologicalShadowResultSchema.parse(job.result_payload)
          : uncertaintyAnalysisResultSchema.parse(job.result_payload);
      if (!abort.current.signal.aborted) {
        setResult(accepted);
        setMessage(
          "Analysis returned. Inspect failed cases and limitations before drawing conclusions.",
        );
      }
    } catch (error) {
      if (!abort.current.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Analysis unavailable.",
        );
    } finally {
      if (!abort.current.signal.aborted) setBusy(false);
    }
  }
  const summary = result ? analysisSummary(result) : null;
  return {
    mode,
    setMode,
    temperature,
    setTemperature,
    temperatureMax,
    setTemperatureMax,
    generationMax,
    setGenerationMax,
    generationFactor,
    setGenerationFactor,
    confirmed,
    setConfirmed,
    busy,
    submitted,
    message,
    result,
    run,
    reviewedPlan,
    valid,
    summary,
  };
}

/** Private, explicitly enabled analysis. Uses the existing owned job service. */
export function PrivateAnalysisReview({
  baseline,
  enabled,
}: {
  baseline: CanonicalPresentation;
  enabled: boolean;
}) {
  const methodHelp = useId();
  const {
    mode,
    setMode,
    temperature,
    setTemperature,
    temperatureMax,
    setTemperatureMax,
    generationMax,
    setGenerationMax,
    generationFactor,
    setGenerationFactor,
    confirmed,
    setConfirmed,
    busy,
    submitted,
    message,
    result,
    run,
    reviewedPlan,
    valid,
    summary,
  } = usePrivateAnalysis(baseline);
  if (!enabled || publicMilpEnabled()) return null;
  return (
    <section className="data-panel ops-private-analysis" aria-label="Private scenario analysis" aria-busy={busy}>
      <details>
      <summary>Explore separate scenarios</summary>
      <h3>Private scenario analysis</h3>
      <p>Choose how to test this plan, review the assumptions, then run a separate analysis.</p>
      <details><summary>Baseline & calculation limits</summary>
      <p>
        Separate analysis uses a solver time cap of{" "}
        {String(reviewedPlan.policy.solver_time_limit_seconds)} seconds per
        solve; physical constraints remain as reviewed below.
      </p>
      <p>
        Accepted baseline: {baseline.projected.identity.resultFingerprint}. Your
        current plan stays unchanged.
      </p>
      </details>
      <label className="ops-chat-alternative-field">
        Analysis method
        <select
          name="private-analysis-method"
          aria-describedby={methodHelp}
          value={mode}
          disabled={submitted}
          onChange={(event) => {
            setMode(event.target.value);
            setConfirmed(false);
          }}
        >
          <option value="independent_scenario_benchmark">
            Independent scenario benchmark
          </option>
          <option value="common_command_scenario_milp">
            Shared commands across supplied scenarios
          </option>
          <option value="chronological" disabled={baseline.points.length < 2}>
            State handoff at the middle of this horizon
          </option>
        </select>
      </label>
      <p id={methodHelp}>{mode === "independent_scenario_benchmark" ? "Optimise each assumed case separately. This compares scenarios; it does not produce one shared schedule." : mode === "common_command_scenario_milp" ? "Test one set of shared commands across the supplied cases." : "Carry modelled battery, cooling and workload state between two windows."}</p>
      {mode !== "chronological" ? (
        <label className="ops-chat-alternative-field">
          Assumed minimum battery temperature, °C
          <input
            type="number"
            name="minimum-battery-temperature"
            step="any"
            autoComplete="off"
            value={temperature}
            disabled={submitted}
            onChange={(event) => {
              setTemperature(event.target.value);
              setConfirmed(false);
            }}
          />
        </label>
      ) : null}
      {mode !== "chronological" ? (
        <>
          <label className="ops-chat-alternative-field">
            Assumed maximum battery temperature, °C
            <input
              type="number"
              name="maximum-battery-temperature"
              step="any"
              autoComplete="off"
              value={temperatureMax}
              disabled={submitted}
              onChange={(e) => {
                setTemperatureMax(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label className="ops-chat-alternative-field">
            Assumed maximum onsite generation, MW
            <input
              type="number"
              name="maximum-onsite-generation"
              step="any"
              autoComplete="off"
              min="0"
              value={generationMax}
              disabled={submitted}
              onChange={(e) => {
                setGenerationMax(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
        </>
      ) : (
        <label className="ops-chat-alternative-field">
          Generation multiplier after the middle cutoff
          <input
            type="number"
            name="generation-multiplier"
            autoComplete="off"
            min="0"
            max="2"
            step="0.1"
            disabled={submitted}
            value={generationFactor}
            onChange={(e) => {
              setGenerationFactor(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
      )}
      <p>
        {mode === "chronological"
          ? "Two windows; apply the reviewed generation multiplier at the middle cutoff. Modelled SOC, thermal debt and remaining work carry into the second window. This does not establish repeated daily delivery."
          : "Two seeded sampled cases within the entered temperature range and 0–maximum generation range; seed 0, equal assumed weights and a 90% scenario threshold. These are assumed scenarios, not calibrated failure probabilities or the unchanged baseline inputs."}
      </p>
      {mode !== "chronological" && !valid ? <p className="ops-analysis-hint">Enter both temperatures and a nonnegative generation limit. Minimum temperature must not exceed maximum.</p> : null}
      <label className="ops-chat-alternative-confirm">
        <input
          name="private-analysis-confirmation"
          type="checkbox"
          checked={confirmed}
          disabled={submitted}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I reviewed this method and the exact assumptions above.
      </label>
      <button
        type="button"
        disabled={
          busy ||
          submitted ||
          !confirmed ||
          (mode !== "chronological"
            ? !valid
            : generationFactor.trim() === "" ||
              !Number.isFinite(Number(generationFactor)) ||
              Number(generationFactor) < 0 ||
              Number(generationFactor) > 2)
        }
        onClick={() => void run(false)}
      >
        {busy ? "Checking analysis…" : "Run separate analysis"}
      </button>
      {submitted && !result ? (
        <button type="button" disabled={busy} onClick={() => void run(true)}>
          {busy ? "Checking analysis…" : "Check analysis status"}
        </button>
      ) : null}
      <p role="status">{busy ? "Your analysis is being checked. This may take a few minutes." : message || (submitted ? "Analysis submitted." : "Review and confirm the assumptions to enable analysis.")}</p>
      {summary ? (
        <section>
          <p role={summary.accepted ? "status" : "alert"}>
            {summary.method}:{" "}
            {summary.accepted
              ? "passed supplied model checks"
              : "did not pass all supplied model checks"}
            .
          </p>
          <ul>
            {summary.cases.map((c) => (
              <li key={c.id}>
                {c.id}: {c.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {result ? (
        <details><summary>Result identity</summary><p translate="no">
          Result identity: {String(result.result_fingerprint)}. Review every
          case outcome below; a returned result may contain failed cases.
        </p></details>
      ) : null}
      {result ? (
        <details>
          <summary>Technical analysis, case outcomes and limitations</summary>
          <pre tabIndex={0}>{JSON.stringify(result, null, 2)}</pre>
        </details>
      ) : null}
      <small>
        Private analytical result only. No measured reliability, market
        enrolment or equipment command.
      </small>
      </details>
    </section>
  );
}
