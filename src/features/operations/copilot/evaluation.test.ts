import { expect, it } from "vitest";
import type { ConversationAnswer } from "./conversation-contracts";
import { evaluateCopilotAnswer, evaluationSummary } from "./evaluation";
const answer = { blocks: ["The target was exceeded."], evidence: [], resolvedQuery: { intent: "power" },
  receipt: { generation: { provider: "meta", stages: [] } }, presentation: "grounded_conversation" } as unknown as ConversationAnswer;
it("does not exempt conversational answers from required meaning", () => {
  expect(evaluateCopilotAnswer(answer, { requiredText: "Target met" }).failures).toContain("missing_required_meaning");
});
it("does not accept a final provider label as proof of Meta-only stages", () => {
  expect(evaluateCopilotAnswer(answer, { provider: "meta" }).failures).toContain("provider_attribution");
});
it("checks complete question coverage independently of wording", () => {
  expect(evaluateCopilotAnswer(answer, { requiredIntents: ["power", "battery"] }).failures).toContain("missing_subquestion");
});
it("reports failures and latency without inventing missing token usage", () => {
  const summary = evaluationSummary([{ passed: true, durationMs: 100, answer }, { passed: false, durationMs: 900, answer: null }]);
  expect(summary).toMatchObject({ cases: 2, passed: 1, failed: 1, latencyP50Ms: 100, latencyP95Ms: 900, knownUsageEstimatedUsd: null });
});
