import { experimentResultSchema } from "../../features/analytics/experiment-contracts";
import { factSchema } from "../../features/operations/copilot/contracts";
import { retrieveOperationalKnowledge } from "./operational-knowledge";
import { answerAnalysisPlan } from "../../features/operations/copilot/analysis-plan";
import { briefRequestSchema } from "../../features/operations/copilot/brief";
import { readOperationsJson, OperationsPayloadError } from "../../lib/operations-request";
import { BriefError, generatePlanBrief, ownedBriefEvidence, ownedAssessment, ownedAnalyticsJob, providerSettings, providerTransport, type ProviderConfig } from "./copilot";
import { conversationRequestSchema, conversationResponseSchema } from "../../features/operations/copilot/conversation-contracts";
import { answerConversation } from "../../features/operations/copilot/conversation-query";
import { interpretQuestion } from "./copilot-conversation";
import { copilotCapabilities } from "./copilot-capabilities";
import { compileExperimentProposal } from "../../features/operations/copilot/experiment-proposal";
import { composeConversation } from "./copilot-composition";

export type CopilotConfig = ProviderConfig & { OPENAI_API_KEY?: string; COPILOT_ENABLED?: string;
  COPILOT_MODEL?: string; COPILOT_ANALYTICS_URL?: string; COPILOT_EXPERIMENTS_ENABLED?: string; COPILOT_ACCOUNTING_ENABLED?: string;
  COPILOT_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> } };

/** One handler shared by the Worker route and direct boundary tests. No second job API. */
async function handleCopilot(request: Request, config: CopilotConfig, fetcher: typeof fetch, conversation: boolean) {
  const headers = { "cache-control": "no-store" };
  if (config.COPILOT_ENABLED !== "true" || !config.COPILOT_ANALYTICS_URL || !config.COPILOT_RATE_LIMITER)
    return Response.json({ error: "Plan explanations are not configured." }, { status: 503, headers });
  try {
    if (!conversation) providerSettings(config);
    const attempts: string[] = [];
    const started = Date.now();
    // Resolve credentials only if a provider call is actually required. Deterministic
    // clarification/definitions remain available without a configured language model.
    let selectedTransport: typeof fetch | undefined;
    const transport: typeof fetch = (input, init) => {
      selectedTransport ??= providerTransport(providerSettings(config), fetcher, attempts);
      return selectedTransport(input, init);
    };
    const receipt = () => ({ provider: attempts.at(-1) ?? "deterministic", attempts: [...new Set(attempts)], elapsedMs: Date.now() - started });
    const bearer = request.headers.get("authorization") ?? "";
    if (!/^Bearer [^\s]+$/i.test(bearer)) throw new BriefError(401, "A calculation session is required.");
    const raw = await readOperationsJson(request, conversation ? 32_768 : 2048);
    const input = (conversation ? conversationRequestSchema : briefRequestSchema).safeParse(raw);
    if (!input.success) throw new BriefError(400, "Invalid explanation request or unsupported brief version.");
    const allowed = await config.COPILOT_RATE_LIMITER.limit({ key: `brief:${request.headers.get("cf-connecting-ip") ?? "local"}` });
    if (!allowed.success) return Response.json({ error: "Please wait before requesting another explanation." },
      { status: 429, headers: { ...headers, "retry-after": "60" } });
    if (conversation) {
      const question = conversationRequestSchema.parse(raw);
      const assessment = await ownedAssessment(config.COPILOT_ANALYTICS_URL, bearer, question.jobId, question.resultFingerprint, fetcher);
      const access = { experiments: config.COPILOT_EXPERIMENTS_ENABLED === "true", accounting: config.COPILOT_ACCOUNTING_ENABLED === "true" };
      const capabilities = copilotCapabilities(!!question.experimentJobId, access);
      const fastExperiment = !!question.experimentJobId && /\b(stress|test(?:ed)?|experiment|comparison)\b/i.test(question.question)
          && !/\b(what if|suppose|imagine|control|dispatch|euros?|carbon)\b/i.test(question.question);
      const interpreted = fastExperiment ? null : await interpretQuestion(assessment, question, "", config.COPILOT_MODEL ?? "gpt-4o-mini", transport, access);
      const queries = interpreted ? interpreted.queries ?? [interpreted.query] : [];
      if (question.experimentJobId && (fastExperiment || queries.length === 1 && queries[0].intent === "experiment")) {
        const job = await ownedAnalyticsJob(config.COPILOT_ANALYTICS_URL, bearer, question.experimentJobId, fetcher);
        if (job.status !== "succeeded" || job.job_type !== "facility_historical_replay")
          throw new BriefError(409, "Experiment is not complete.");
        const experiment = experimentResultSchema.parse(job.result_payload);
        if (experiment.baseline_result_fingerprint !== question.resultFingerprint)
          throw new BriefError(409, "Experiment belongs to a different plan.");
        const query = { intent: "checks", workloadId: null, start: null, end: null, focus: "selected", definition: "none" } as const;
        const answer = answerConversation(assessment, question, query, { model: "checked-experiment-evidence", responseId: null, usage: null });
        const facts = experiment.cases.flatMap((item, index) => [
          { key: "accepted", label: "Stress checks passed", value: item.accepted, unit: "status" },
          { key: "peak_import_mw", label: "Tested peak import", value: item.peak_import_mw, unit: "MW" },
          { key: "above_import_limit_minutes", label: "Tested time above limit", value: item.above_import_limit_minutes, unit: "min" },
          { key: "remaining_work_hours", label: "Tested remaining work", value: item.remaining_work_hours, unit: "work h" },
          ...(item.metrics ? [
            { key: "grid_import_mwh", label: `${item.case_id}: grid energy`, value: item.metrics.grid_import_mwh, unit: "MWh AC" },
            { key: "minimum_soc_fraction", label: `${item.case_id}: minimum SOC fraction`, value: item.metrics.minimum_soc_fraction == null ? null : item.metrics.minimum_soc_fraction * 100, unit: "%" },
            { key: "above_target_minutes", label: `${item.case_id}: above safety target`, value: item.metrics.above_target_minutes, unit: "min" },
            { key: "deadline_checks_met", label: `${item.case_id}: deadlines met`, value: item.metrics.deadline_checks_met, unit: "count" },
          ] : []),
        ].map(f => factSchema.parse({ id: `experiment.${index}.${f.key}`, label: f.label, unit: f.unit, scope: "full_horizon",
          availability: f.value == null ? "unavailable" : "available", value: f.value ?? null,
          source: { view: "overview", selector: `Experiment:${job.id}:${experiment.result_fingerprint}`, field: `cases[${index}].${item.metrics && f.key in item.metrics ? "metrics." : ""}${f.key}` } })));
        const experimentAnswer = conversationResponseSchema.parse({ ...answer, blocks: experiment.cases.flatMap(item => [
          `Experiment ${item.case_id}: ${item.mode === "frozen_plan" ? "accepted commands held fixed" : "separate re-optimisation"}. ${item.status === "unsupported_or_invalid" ? "This case could not be assessed." : item.accepted ? "The supplied checks passed." : "The supplied checks did not pass."}`,
          ...(item.first_violation_index != null ? [`First returned violation: ${assessment.points[item.first_violation_index]?.timestamp ?? "unknown interval"}.`] : []),
          ...(item.violations?.length ? [`Returned violations: ${[...new Set(item.violations.map(v => v.code))].join(", ")}.`] : []),
        ]), evidence: facts, navigation: [], capabilities, guidance: retrieveOperationalKnowledge(question.question),
          limitations: ["Assumed stress scenarios are not a calibrated reliability probability.",
            "This tests the submitted model, not measured delivery, rack temperatures or subinterval ramps."],
          receipt: { ...answer.receipt, generation: receipt() } });
        const composed = question.transcript ? await composeConversation(question, experimentAnswer, transport) : experimentAnswer;
        return Response.json(conversationResponseSchema.parse({ ...composed, receipt: { ...composed.receipt, generation: receipt() } }), { headers });
      }
      if (!interpreted) throw new BriefError(422, "Question interpretation unavailable.");
      const answer = answerAnalysisPlan(assessment, question, queries, interpreted.provider);
      let proposal;
      let proposalClarification;
      if (queries.some(query => query.intent === "what_if")) {
        if (!access.experiments) proposalClarification = "Exact-baseline experiments are unavailable in this service. A new synthetic calculation is not an exact comparison.";
        else if (interpreted.proposal) {
          try { proposal = await compileExperimentProposal(assessment, question.jobId, interpreted.proposal); }
          catch (error) { proposalClarification = error instanceof Error ? error.message : "Clarify the proposed change."; }
        } else proposalClarification = "Specify the asset, exact change and unit. Battery energy (MWh) and power (MW) are different changes.";
      }
      const guidanceAllowed = answer.kind === "answer" || answer.evidence.length > 0 ||
        queries.some(query => ["what_if", "readiness", "diagnosis", "knowledge", "accounting"].includes(query.intent));
      const grounded = conversationResponseSchema.parse({ ...answer, capabilities, proposal, proposalClarification,
        guidance: guidanceAllowed ? retrieveOperationalKnowledge(`${question.question} ${queries.map(query => query.intent).join(" ")}`, { intents: queries.map(query => query.intent) }) : [] });
      const composed = question.transcript ? await composeConversation(question, grounded, transport) : grounded;
      return Response.json(conversationResponseSchema.parse({ ...composed, receipt: { ...composed.receipt, generation: receipt() } }), { headers });
    }
    const evidence = await ownedBriefEvidence(config.COPILOT_ANALYTICS_URL, bearer, input.data.jobId, input.data.resultFingerprint, fetcher);
    const provider = providerSettings(config);
    const brief = await generatePlanBrief(evidence, provider.key, provider.model, transport);
    return Response.json({ ...brief, receipt: { ...brief.receipt, generation: receipt() } }, { headers });
  } catch (error) {
    if (error instanceof BriefError || error instanceof OperationsPayloadError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
      return Response.json({ error: "Explanation timed out. The calculated plan is still available." }, { status: 504, headers });
    return Response.json({ error: "The explanation could not be verified. No brief accepted." }, { status: 422, headers });
  }
}

export const handlePlanBrief = (request: Request, config: CopilotConfig, fetcher: typeof fetch = fetch) =>
  handleCopilot(request, config, fetcher, false);
export const handlePlanConversation = (request: Request, config: CopilotConfig, fetcher: typeof fetch = fetch) =>
  handleCopilot(request, config, fetcher, true);
