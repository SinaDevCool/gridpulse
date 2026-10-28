import { expect, it, vi } from "vitest";
import { handlePlanBrief } from "./copilot-handler";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";
import { BRIEF_VERSION, briefSchema } from "../../features/operations/copilot/contracts";
import { briefText } from "../../features/operations/copilot/brief";

const baseline = canonicalMilpJob(buildSyntheticMilpRequest(defaultOperationsScenario));
const id = "11111111-1111-4111-8111-111111111111";
const result = { schema_version: "gridpulse-facility-experiment-result-v1", engine_version: "fixture",
  input_fingerprint: "b".repeat(64), result_fingerprint: "c".repeat(64), baseline_result_fingerprint: "a".repeat(64),
  scenario_basis: "assumed_not_calibrated_probability", capacity_claim: false, automatic_live_dispatch_authorized: false,
  cases: [{ case_id: "lower-limit", mode: "frozen_plan", status: "completed", accepted: false }] };
const config = { COPILOT_ENABLED: "true", COPILOT_ANALYTICS_URL: "https://analytics.invalid", COPILOT_PROVIDER: "meta",
  META_API_KEY: "test", COPILOT_MODEL: "muse-spark-1.3", COPILOT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const request = () => new Request("https://app.invalid/api/operations/brief", { method: "POST",
  headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ version: BRIEF_VERSION,
    jobId: baseline.id, resultFingerprint: "a".repeat(64), experimentJobId: id }) });
const provider = () => Response.json({ status: "completed", model: "muse-spark-1.3", output: [{ content: [{ type: "output_text",
  text: JSON.stringify({ findings: ["peak"], actions: ["review_inputs"] }) }] }] });

it("exports a failed owned stress test as evidence, without relabelling it accepted", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(baseline)).mockResolvedValueOnce(provider())
    .mockResolvedValueOnce(Response.json({ ...baseline, id, job_type: "facility_historical_replay", result_payload: result }));
  const response = await handlePlanBrief(request(), config, fetcher);
  expect(response.status).toBe(200);
  const brief = briefSchema.parse(await response.json());
  expect(brief.investigation?.jobId).toBe(id);
  expect(briefText(brief)).toContain("Did not pass supplied model checks");
  expect(briefText(brief)).toContain(result.result_fingerprint);
});

it("rejects investigation evidence attached to a different baseline", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(baseline)).mockResolvedValueOnce(provider())
    .mockResolvedValueOnce(Response.json({ ...baseline, id, job_type: "facility_historical_replay",
      result_payload: { ...result, baseline_result_fingerprint: "d".repeat(64) } }));
  expect((await handlePlanBrief(request(), config, fetcher)).status).toBe(409);
});
