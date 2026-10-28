import { describe, expect, it, vi } from "vitest";
import { handlePlanConversation, type CopilotConfig } from "./copilot-handler";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";
import { CHAT_VERSION, conversationResponseSchema } from "../../features/operations/copilot/conversation-contracts";

const job = canonicalMilpJob(buildSyntheticMilpRequest(defaultOperationsScenario));
const body = { version: CHAT_VERSION, jobId: job.id, resultFingerprint: job.result_payload.result_fingerprint,
  question: "Which workloads run then?", history: ["What happens at the selected interval?"],
  context: { view: "compute", timestamp: job.input_payload.intervals[0].start, workloadId: null } };
const options = (): CopilotConfig => ({ COPILOT_ENABLED: "true", OPENAI_API_KEY: "test-secret", COPILOT_ANALYTICS_URL: "https://analytics.invalid",
  COPILOT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } });
const query = { intent: "interval", workloadId: null, start: null, end: null, focus: "selected", definition: "none" };
const response = (selection: unknown = query) => Response.json({ id: "provider-response", status: "completed", model: "test-model",
  usage: { input_tokens: 100, output_tokens: 30 }, output: [{ content: [{ type: "output_text", text: JSON.stringify(selection) }] }] });
const request = (input: unknown = body, auth = "Bearer visitor-token") => new Request("https://app.invalid/api/operations/conversation", {
  method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(input) });

describe("conversation boundary", () => {
  it.each([
    ["Why did the solver prefer this exact training start over every other start?", "unsupported", "why"],
    ["Minimise the bill by changing the workload schedule.", "requires_calculation", "what_if"],
    ["Does this plan guarantee additional grid connection capacity?", "answer", "readiness"],
    ["Why do we need a new calculation after changing the inputs?", "answer", "knowledge"],
  ])("keeps a known capability boundary deterministic: %s", async (question, kind, intent) => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe(kind);
    expect(answer.resolvedQuery.intent).toBe(intent);
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (intent === "knowledge") expect(answer.blocks.join(" ")).toContain("accepted result applies only");
  });
  it("prepares an exact proposal only when enabled, without submitting a job", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "What if battery energy is halved?" }),
      { ...options(), COPILOT_EXPERIMENTS_ENABLED: "true" }, fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.proposal?.request.baseline_job_id).toBe(job.id);
    expect(answer.proposal?.request.cases[0].changes[0].value).toBe(Number(job.input_payload.batteries![0].rated_energy_mwh) / 2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("compiles provider-neutral workload-duration proposals through the existing field contract", async () => {
    const workloadId = String(job.input_payload.workloads[0].workload_id);
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({
      queries: [{ ...query, intent: "what_if", workloadId }], proposal: { mode: "alternative", changes: [
        { field: "workload_duration_multiplier", asset_id: workloadId, operation: "set", value: 1.5, unit: "x" }] } }));
    const result = await handlePlanConversation(request({ ...body, question: "What if this workload takes 50 percent longer?" }),
      { ...options(), COPILOT_EXPERIMENTS_ENABLED: "true" }, fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.proposal?.request.cases[0].changes[0]).toMatchObject({ field: "workload_duration_multiplier", value: 1.5, asset_id: workloadId });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("clarifies unavailable exact experiments instead of promising an equivalent synthetic run", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "What if battery energy is halved?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.proposal).toBeUndefined();
    expect(answer.proposalClarification).toContain("not an exact comparison");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("offers labelled battery guidance while requiring a separate counterfactual calculation", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries: [{ ...query, intent: "what_if" }] }));
    const result = await handlePlanConversation(request({ ...body, question: "What if battery capacity is halved?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe("requires_calculation");
    expect(answer.guidance?.some(item => item.id === "battery-energy")).toBe(true);
    expect(answer.investigation?.status).toBe("requires_independent_validation");
    expect(fetcher).toHaveBeenCalledTimes(1); // owned retrieval; deterministic what-if routing, no hidden solve
  });
  it("loads the owned result, interprets follow-ups and renders verified evidence in one bounded provider call", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response());
    const result = await handlePlanConversation(request(), options(), fetcher);
    expect(result.status).toBe(200);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.receipt).toMatchObject({ jobId: job.id, providerResponseId: "provider-response", usage: { inputTokens: 100, outputTokens: 30 } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(sent.store).toBe(false); expect(sent.text.format.strict).toBe(true);
    expect(sent.input).toContain("previousUserQuestions"); expect(sent.input).not.toContain("visitor-token");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("combines existing checked selectors for a risk review and labels general knowledge separately", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ ...query, intent: "checks" }));
    const result = await handlePlanConversation(request({ ...body, question: "Review the risks in this plan" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.evidence.some(fact => fact.id === "power.plan_peak")).toBe(true);
    expect(answer.evidence.some(fact => fact.id === "power.limit")).toBe(true);
    expect(answer.guidance?.length).toBeGreaterThan(0);
    expect(answer.receipt.generation).toMatchObject({ provider: "openai", attempts: ["openai"] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects access, identity and oversized-history failures before provider access", async () => {
    const noAuth = vi.fn(); expect((await handlePlanConversation(request(body, ""), options(), noAuth)).status).toBe(401);
    expect(noAuth).not.toHaveBeenCalled();
    const foreign = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    expect((await handlePlanConversation(request(), options(), foreign)).status).toBe(404); expect(foreign).toHaveBeenCalledTimes(1);
    const mismatch = vi.fn().mockResolvedValue(Response.json(job));
    expect((await handlePlanConversation(request({ ...body, resultFingerprint: "f".repeat(64) }), options(), mismatch)).status).toBe(409);
    const invalid = vi.fn(); expect((await handlePlanConversation(request({ ...body, history: Array(7).fill("x") }), options(), invalid)).status).toBe(400);
    expect(invalid).not.toHaveBeenCalled();
  });
  it("shares the brief allowance and does not retry unsupported provider output", async () => {
    const config = options(); config.COPILOT_RATE_LIMITER!.limit = vi.fn().mockResolvedValue({ success: false });
    const fetcher = vi.fn(); expect((await handlePlanConversation(request(), config, fetcher)).status).toBe(429);
    expect(config.COPILOT_RATE_LIMITER!.limit).toHaveBeenCalledWith({ key: "brief:local" });
    for (const selection of [{ ...query, intent: "run_code" }, { ...query, prose: "Invented savings" }]) {
      const provider = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response(selection));
      expect((await handlePlanConversation(request(), options(), provider)).status).toBe(422); expect(provider).toHaveBeenCalledTimes(2);
    }
  });
  it("clarifies a bare hour without spending a provider call or guessing morning/evening", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "What happens at eight?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe("clarification"); expect(answer.receipt.providerResponseId).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never treats an explicit hypothetical as a current result", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "Suppose we increased the protected reserve to 30 percent." }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe("requires_calculation"); expect(answer.evidence).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


describe("checked experiment follow-up", () => {
  const experimentId = "03d2ff97-82ec-4b6b-96e8-bc1ace7735da";
  const experiment = { ...job, id: experimentId, status: "succeeded", job_type: "facility_historical_replay",
    result_payload: { schema_version: "gridpulse-facility-experiment-result-v1", engine_version: "test",
      input_fingerprint: "a".repeat(64), result_fingerprint: "b".repeat(64),
      baseline_result_fingerprint: body.resultFingerprint, scenario_basis: "assumed_not_calibrated_probability",
      capacity_claim: false, automatic_live_dispatch_authorized: false,
      cases: [{ case_id: "capacity-half", mode: "frozen_plan", status: "completed", accepted: false,
        peak_import_mw: 105, above_import_limit_minutes: 15, remaining_work_hours: 0,
        first_violation_index: 0, violations: [{ code: "import_limit", interval_index: 0 }] }] } };
  it("uses the owned experiment without sending its values to a provider", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(Response.json(experiment));
    const result = await handlePlanConversation(request({ ...body, question: "Explain the stress test", experimentJobId: experimentId }), options(), fetcher);
    expect(result.status).toBe(200);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.blocks.join(" ")).toContain("did not pass");
    expect(answer.evidence.some(f => f.source.selector.includes(experimentId))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("renders engine comparison metrics with valid evidence units and source paths", async () => {
    const enriched = structuredClone(experiment);
    Object.assign(enriched.result_payload.cases[0], { metrics: {
      grid_import_mwh: 100, above_target_minutes: 30, minimum_soc_fraction: .4,
      battery_delivered_mwh: 2, battery_equivalent_full_cycles: .1, terminal_target_met: true,
      deadline_checks_met: 5, workload_count: 5, rebound_peak_mw: null,
      basis: "canonical_physical_replay", causal_binding_constraints_assessed: false,
    } });
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(Response.json(enriched));
    const result = await handlePlanConversation(request({ ...body, question: "Explain the stress test", experimentJobId: experimentId }), options(), fetcher);
    expect(result.status).toBe(200);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.evidence.find(f => f.id === "experiment.0.minimum_soc_fraction")).toMatchObject({ value: 40, unit: "%", source: { field: "cases[0].metrics.minimum_soc_fraction" } });
  });
  it("rejects foreign experiments and results from another baseline", async () => {
    const foreign = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await handlePlanConversation(request({ ...body, question: "Explain the stress test", experimentJobId: experimentId }), options(), foreign)).status).toBe(404);
    const different = { ...experiment, result_payload: { ...experiment.result_payload, baseline_result_fingerprint: "c".repeat(64) } };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(Response.json(different));
    expect((await handlePlanConversation(request({ ...body, question: "Explain the stress test", experimentJobId: experimentId }), options(), fetcher)).status).toBe(409);
  });
});


describe("bounded expert analysis", () => {
  it("retains power, battery and workload parts in one checked response", async () => {
    const queries = ["power", "battery", "interval"].map(intent => ({ ...query, intent }));
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries }));
    const result = await handlePlanConversation(request({ ...body, question: "Review peak reduction, reserve and which workloads run." }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.resolvedQueries).toHaveLength(3);
    expect(answer.coverage?.every(part => part.status === "answer")).toBe(true);
    expect(answer.evidence.some(fact => fact.id === "power.plan_peak")).toBe(true);
    expect(new Set(answer.evidence.map(fact => fact.id)).size).toBe(answer.evidence.length);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not confuse PUE with MW versus MWh and works without provider credentials", async () => {
    const config = options(); delete config.OPENAI_API_KEY;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "What does PUE mean?" }), config, fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.resolvedQuery.definition).toBe("pue");
    expect(answer.blocks.join(" ")).toContain("double-count");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not classify fixed-schedule tariff accounting as a new physical solve", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries: [{ ...query, intent: "accounting" }] }));
    const result = await handlePlanConversation(request({ ...body, question: "Can you calculate cost if I provide a tariff?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).not.toBe("requires_calculation");
    expect(answer.blocks.join(" ")).toContain("does not require another MILP");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("explains operational-readiness gaps for approval questions independent of English keyword expansion", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries: [{ ...query, intent: "readiness" }] }));
    const result = await handlePlanConversation(request({ ...body, question: "Can the operator approve this for actual use?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.blocks.join(" ")).toContain("do not authorise live operation");
    expect(answer.investigation?.requiredEvidence.join(" ")).toContain("PCC and IT meter boundaries");
    expect(answer.investigation?.status).toBe("requires_independent_validation");
    expect(answer.evidence.some(fact => fact.id === "power.plan_peak")).toBe(true);
  });
  it("preserves unsupported/control parts alongside supported facts", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries: [{ ...query, intent: "power" }, { ...query, intent: "unsupported" }] }));
    const result = await handlePlanConversation(request(), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe("answer");
    expect(answer.coverage?.map(part => part.status)).toEqual(["answer", "unsupported"]);
  });
  it("rejects an over-budget plan and never accepts provider prose", async () => {
    for (const selection of [{ queries: Array(5).fill(query) }, { queries: [query], prose: "guaranteed safe" }]) {
      const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response(selection));
      expect((await handlePlanConversation(request(), options(), fetcher)).status).toBe(422);
    }
  });
});


it("returns schedules and explicitly withholds unreturned per-job baseline movement", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response({ queries: [{ ...query, intent: "power" }, { ...query, intent: "workloads" }] }));
  const result = await handlePlanConversation(request({ ...body, question: "Explain power and which jobs moved" }), options(), fetcher);
  const answer = conversationResponseSchema.parse(await result.json());
  expect(answer.blocks.join(" ")).toContain("cannot establish which jobs moved");
  expect(answer.evidence.filter(fact => fact.id.startsWith("schedule."))).toHaveLength(5);
  expect(answer.resolvedQueries).toHaveLength(2);
});
