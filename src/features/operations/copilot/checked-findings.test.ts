import { it, expect } from "vitest";
import { checkedFindings } from "./checked-findings";
import type { ConversationAnswer } from "./conversation-contracts";
import { formatBriefFact } from "./brief";
import type { BriefFact } from "./contracts";
import { answerBlocks } from "./conversation-presentation";
const base = {
  blocks: ["Important warning.", "Second fact."],
  guidance: [],
  evidence: [],
  receipt: { resultFingerprint: "a".repeat(64) },
} as unknown as ConversationAnswer;
it("retains stable finding identities across model reordering", () => {
  const a = checkedFindings(base),
    b = checkedFindings({ ...base, blocks: [...base.blocks].reverse() });
  expect(a[0].id).toBe(b[1].id);
  expect(
    a.every(
      (f) =>
        f.mandatory && f.resultFingerprint === base.receipt.resultFingerprint,
    ),
  ).toBe(true);
});
it("does not hide composed text when fact cards are not rendered", () => {
  expect(answerBlocks(["Important fact."], [], false)).toEqual([
    "Important fact.",
  ]);
});

it("preserves an exact fact summary when composed mode hides cards", () => {
  const fact = {
    id: "power.plan_peak",
    label: "Plan peak",
    availability: "available",
    value: 1,
    unit: "MW",
    scope: "full_horizon",
    source: { view: "overview", selector: "canonical", field: "peak" },
  } as BriefFact;
  const block = `${fact.label}: ${formatBriefFact(fact)}.`;
  expect(answerBlocks([block], [fact], false)).toEqual([block]);
  expect(answerBlocks([block], [fact], true)).toEqual([]);
});
