import type { CopilotNavigation } from "./conversation-contracts";
import type { BriefFact } from "./contracts";
import { formatBriefFact } from "./brief";

export function contextLabel(context: CopilotNavigation) {
  const view = context.view === "power" ? "Power & Battery" : context.view === "compute" ? "Compute & Workloads" : "Overview";
  const date = context.timestamp ? new Date(context.timestamp) : null;
  return `${view} · ${date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23",
  }).format(date) + " UTC selected" : "Whole plan"}`;
}

/** No prose parsing, inferred arithmetic, or absent values converted into zero. */
export function answerFacts(facts: BriefFact[]) {
  return facts.filter(fact => fact.availability === "available" && typeof fact.value === "number").slice(0, 3);
}

export function answerBlocks(blocks: string[], facts: BriefFact[]) {
  const cards = answerFacts(facts);
  return blocks.filter(block => !cards.some(fact => block === `${fact.label}: ${formatBriefFact(fact)}.`))
    .map(block => facts.reduce((text, fact) => {
      if (fact.availability !== "available" || typeof fact.value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(fact.value)) return text;
      return text.replaceAll(fact.value, formatBriefFact(fact));
    }, block));
}
