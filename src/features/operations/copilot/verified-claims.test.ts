import { describe, expect, it } from "vitest";
import type { ConversationAnswer } from "./conversation-contracts";
import { renderVerifiedClaims } from "./verified-claims";

const answer = { blocks: ["Time above target: 60 min.", "Deadline evidence is unavailable."],
  basis: "model_evidence", receipt: { resultFingerprint: "a".repeat(64) } } as ConversationAnswer;

describe("verified claim selection", () => {
  it("retains unselected warnings and uses only executor text", () => {
    expect(renderVerifiedClaims({ findingIds: ["finding.1"] }, answer).blocks)
      .toEqual([answer.blocks[1], answer.blocks[0]]);
  });
  it.each([
    { paragraphs: [{ text: "Grid import never exceeds the operating target.", factIds: ["power.above_target_minutes"], guidanceIds: [] }] },
    { findingIds: ["finding.0"], text: "All deadlines met." },
    { findingIds: ["unknown"] }, { findingIds: ["finding.0", "finding.0"] }, { findingIds: [] },
  ])("rejects unsupported text or references", raw => expect(() => renderVerifiedClaims(raw, answer)).toThrow());
});
