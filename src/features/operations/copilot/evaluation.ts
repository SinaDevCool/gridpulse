import type { ConversationAnswer } from "./conversation-contracts";

export type AnswerExpectations = { requiredText?: string; forbiddenText?: string[];
  requiredEvidenceIds?: string[]; requiredIntents?: string[]; provider?: "meta" | "openai" };

/** Expected meaning is independent of the writer's requested schema or presentation label. */
export function evaluateCopilotAnswer(answer: ConversationAnswer | null, expected: AnswerExpectations) {
  const failures: string[] = [];
  if (!answer) return { passed: false, failures: ["missing_answer"] };
  const text = answer.blocks.join("\n");
  if (expected.requiredText && !text.includes(expected.requiredText)) failures.push("missing_required_meaning");
  if (expected.forbiddenText?.some(value => text.toLowerCase().includes(value.toLowerCase()))) failures.push("forbidden_claim");
  if (expected.requiredEvidenceIds?.some(id => !answer.evidence.some(fact => fact.id === id))) failures.push("missing_evidence");
  if (expected.requiredIntents?.some(intent => !(answer.resolvedQueries ?? [answer.resolvedQuery]).some(query => query.intent === intent))) failures.push("missing_subquestion");
  if (expected.provider) {
    const stages = answer.receipt.generation?.stages ?? [];
    if (!stages.length || stages.some(stage => stage.provider !== expected.provider || stage.fallbackReason || stage.outcome !== "responded" || stage.httpStatus !== 200))
      failures.push("provider_attribution");
  }
  return { passed: !failures.length, failures };
}

export function evaluationSummary(records: { passed: boolean; durationMs: number; answer: ConversationAnswer | null }[]) {
  const durations = records.map(record => record.durationMs).sort((a, b) => a - b);
  const stages = records.flatMap(record => record.answer?.receipt.generation?.stages ?? []);
  const known = stages.filter(stage => stage.usage !== null);
  const inputTokens = known.reduce((sum, stage) => sum + stage.usage!.inputTokens, 0);
  const outputTokens = known.reduce((sum, stage) => sum + stage.usage!.outputTokens, 0);
  const spark = known.every(stage => stage.provider === "meta" && stage.servedModel === "muse-spark-1.3");
  return { cases: records.length, passed: records.filter(record => record.passed).length,
    failed: records.filter(record => !record.passed).length,
    latencyP50Ms: durations.length ? durations[Math.ceil(durations.length * .5) - 1] : null,
    latencyP95Ms: durations.length ? durations[Math.ceil(durations.length * .95) - 1] : null,
    providerAttempts: stages.length, attemptsWithUnknownUsage: stages.length - known.length,
    knownInputTokens: inputTokens, knownOutputTokens: outputTokens,
    knownUsageEstimatedUsd: known.length && spark ? (inputTokens * 1.25 + outputTokens * 4.25) / 1_000_000 : null,
    pricingSnapshot: "2026-10-28; Standard Spark 1.3; cache discounts not applied; unknown attempts excluded; not an invoice",
    checkedFallbacks: records.filter(record => record.answer?.presentation === "checked_fallback").length };
}
