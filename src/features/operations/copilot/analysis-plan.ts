import { investigationFor } from "./investigation";
import type { CanonicalPresentation } from "../canonical-presentation";
import { answerConversation } from "./conversation-query";
import { conversationResponseSchema, type ConversationQuery, type ConversationRequest } from "./conversation-contracts";

/** Bounded composition over the existing selectors. No generated numerical claims. */
export function answerAnalysisPlan(a: CanonicalPresentation, request: ConversationRequest, queries: ConversationQuery[],
  provider: Parameters<typeof answerConversation>[3]) {
  const selected = queries.slice(0, 4);
  const answers = selected.map(query => {
    if (query.intent !== "readiness" && query.intent !== "diagnosis" && !(query.intent === "checks" && /risk|readiness|review|trade.off|assess/i.test(request.question)))
      return answerConversation(a, request, query, provider);
    const sections = (query.intent === "diagnosis" ? ["battery", "constraints", "interval"] as const : ["checks", "power", "constraints"] as const).map(intent => answerConversation(a, request,
      { ...query, intent, workloadId: null, ...(query.intent === "diagnosis" ? {} : { start: null, end: null, focus: "selected" as const }), definition: "none" }, provider));
    return { ...sections[0], resolvedQuery: query,
      blocks: [query.intent === "diagnosis" ? "Investigation: inspect the returned battery state and power balance first; a zero dispatch does not by itself identify the binding constraint." : "Decision boundary: model checks alone do not authorise live operation.",
        ...sections.flatMap(section => section.blocks),
        "Independent site verification is not established by model checks. Assumed stress cases do not establish failure probabilities."],
      evidence: [...new Map(sections.flatMap(section => section.evidence).map(fact => [fact.id, fact])).values()],
      navigation: sections.flatMap(section => section.navigation) };
  });
  const first = answers[0];
  const facts = answers.flatMap((answer, i) => answer.evidence.map(fact => ({ ...fact,
    id: selected.length > 1 && fact.id.startsWith("job.") ? `query.${i}.${fact.id}` : fact.id })));
  if (selected.some(query => query.intent === "diagnosis") && a.diagnosticEvidence?.available) {
    for (const [index, finding] of a.diagnosticEvidence.findings.entries()) {
      if (finding.interval_index >= a.points.length) continue;
      facts.push({ id: `diagnostic.${index}`, label: finding.code.replaceAll("_", " "),
        unit: finding.unit === "MWh" ? "MWh DC" : "MW", scope: "full_horizon", availability: "available", value: finding.value,
        source: { view: finding.unit === "MWh" ? "power" : "overview", selector: `EngineDiagnostic:${finding.code}:${finding.asset_id}`, field: `diagnostic_evidence.findings[${index}].value` } });
    }
  }
  const hasAnswer = answers.some(answer => answer.kind === "answer");
  const kind = answers.some(answer => answer.kind === "requires_calculation") ? "requires_calculation" : hasAnswer ? "answer" : first.kind;
  const blocks = [...new Set(answers.flatMap(answer => answer.blocks))];
  // Budget overflow must be explicit; never silently discard a requested sub-answer.
  if (blocks.length > 64 || new Set(facts.map(fact => fact.id)).size > 160)
    return conversationResponseSchema.parse({ ...first, kind: "clarification", basis: "no_calculation", evidence: [], navigation: [],
      blocks: ["This question exceeds the evidence budget. Please split it into individual workload or time-range questions."],
      resolvedQueries: selected, coverage: selected.map(query => ({ intent: query.intent, status: "clarification" })) });
  return conversationResponseSchema.parse({ ...first, kind,
    ...(selected.some(query => ["readiness", "diagnosis", "what_if"].includes(query.intent)) ? {
      investigation: investigationFor(a, selected)
    } : {}),
    basis: hasAnswer ? (answers.filter(answer => answer.kind === "answer").every(answer => answer.basis === "general_explanation") ? "general_explanation" : "model_evidence") : "no_calculation",
    blocks, evidence: [...new Map(facts.map(fact => [fact.id, fact])).values()],
    navigation: [...new Map(answers.flatMap(answer => answer.navigation).map(target => [JSON.stringify(target), target])).values()].slice(0, 8),
    resolvedQueries: selected, coverage: answers.map((answer, i) => ({ intent: selected[i].intent, status: answer.kind })) });
}
