import type { CopilotNavigation } from "./conversation-contracts";
import type { BriefFact } from "./contracts";
import { formatBriefFact } from "./brief";
import { formatOperationsInterval, formatOperationsTime } from "../presentation";

export function contextLabel(context: CopilotNavigation, endTimestamp?: string | null) {
  const view = context.view === "power" ? "Power & Battery" : context.view === "compute" ? "Compute & Workloads" : "Overview";
  const date = context.timestamp ? new Date(context.timestamp) : null;
  return `${view} · ${date && Number.isFinite(date.getTime()) ?
    (endTimestamp ? formatOperationsInterval(context.timestamp!, endTimestamp) : formatOperationsTime(context.timestamp!, true)) + " selected" : "Whole plan"}`;
}

/** No prose parsing, inferred arithmetic, or absent values converted into zero. */
export function answerFacts(facts: BriefFact[]) {
  const priority = ["power.plan_peak", "power.target", "battery.minimum_soc", "workloads.completed", "workloads.remaining"];
  return facts.filter(fact => fact.availability === "available" && typeof fact.value === "number")
    .map((fact, index) => ({ fact, rank: priority.includes(fact.id) ? priority.indexOf(fact.id) : 100 + index }))
    .sort((a, b) => a.rank - b.rank).slice(0, 3).map(item => item.fact);
}

export function answerBlocks(blocks: string[], facts: BriefFact[], cardsRendered = true) {
  const cards = cardsRendered ? answerFacts(facts) : [];
  return blocks.filter(block => !cards.some(fact => block === `${fact.label}: ${formatBriefFact(fact)}.`))
    .map(block => facts.reduce((text, fact) => {
      if (fact.availability !== "available" || typeof fact.value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(fact.value)) return text;
      return text.replaceAll(fact.value, formatBriefFact(fact));
    }, block));
}
