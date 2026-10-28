import { describe, expect, it, vi } from "vitest";
import { experimentRequestSchema } from "../../analytics/experiment-contracts";
import { acceptExperimentResult, matchingExperimentJobs, submitCalculation } from "./experiment-lifecycle";
import type { AnalyticsJob } from "../../analytics/job-contracts";

const request = experimentRequestSchema.parse({ schema_version: "gridpulse-facility-experiment-request-v1",
  baseline_job_id: "11111111-1111-4111-8111-111111111111", baseline_result_fingerprint: "a".repeat(64),
  cases: [{ case_id: "lower-limit", mode: "frozen_plan", changes: [{ field: "import_limit_mw", value: 95 }] }] });
const result = { schema_version: "gridpulse-facility-experiment-result-v1", engine_version: "fixture",
  input_fingerprint: "b".repeat(64), result_fingerprint: "c".repeat(64), baseline_result_fingerprint: "a".repeat(64),
  scenario_basis: "assumed_not_calibrated_probability", capacity_claim: false, automatic_live_dispatch_authorized: false,
  cases: [{ case_id: "lower-limit", mode: "frozen_plan", status: "completed", accepted: false }] };
describe("experiment result acceptance", () => {
  it("recovers only exact baseline and change matches from owner-scoped history", () => {
    const job = { id: "owned", job_type: "facility_historical_replay", input_payload: {
      schema_version: request.schema_version, baseline: { result_fingerprint: request.baseline_result_fingerprint }, cases: request.cases } } as unknown as AnalyticsJob;
    const other = { ...job, id: "other", input_payload: { ...job.input_payload, cases: [] } };
    expect(matchingExperimentJobs([other, job], request).map(row => row.id)).toEqual(["owned"]);
  });
  it("submits a fresh exact experiment without a normal-plan snapshot", async () => {
    const plan = vi.fn();
    const experiment = vi.fn().mockResolvedValue({ job_id: "owned-experiment" });
    await expect(submitCalculation(null, request, { plan, experiment })).resolves.toBe("owned-experiment");
    expect(experiment).toHaveBeenCalledOnce();
    expect(experiment).toHaveBeenCalledWith(request);
    expect(plan).not.toHaveBeenCalled();
    await expect(submitCalculation(null, null, { plan, experiment })).rejects.toThrow("snapshot");
  });
  it("retains a failed model check as a completed experiment", () => {
    expect(acceptExperimentResult(result, request).cases[0].accepted).toBe(false);
  });
  it.each([
    { ...result, baseline_result_fingerprint: "d".repeat(64) },
    { ...result, cases: [{ ...result.cases[0], mode: "alternative" }] },
    { ...result, cases: [{ ...result.cases[0], case_id: "other" }] },
    { ...result, automatic_live_dispatch_authorized: true },
  ])("rejects cross-plan, cross-case and operational results", raw => {
    expect(() => acceptExperimentResult(raw, request)).toThrow();
  });
});
