import { z } from "zod";
import type { ConversationAnswer } from "./conversation-contracts";

export const claimSelectionSchema = z.object({
  findingIds: z.array(z.string().min(1).max(120)).min(1).max(64),
}).strict();

/** The checked executor supplies findings. The model can prioritise but not rewrite them. */
export function verifiedConversationClaims(answer: ConversationAnswer) {
  return answer.blocks.map((text, index) => ({ id: `finding.${index}`, text, mandatory: true,
    resultFingerprint: answer.receipt.resultFingerprint, basis: answer.basis }));
}

export function renderVerifiedClaims(raw: unknown, answer: ConversationAnswer) {
  const selection = claimSelectionSchema.parse(raw);
  const claims = verifiedConversationClaims(answer);
  const byId = new Map(claims.map(claim => [claim.id, claim]));
  if (new Set(selection.findingIds).size !== selection.findingIds.length ||
    selection.findingIds.some(id => !byId.has(id))) throw new Error("Invalid checked finding selection.");
  const ids = [...new Set([...selection.findingIds, ...claims.map(claim => claim.id)])];
  return { blocks: ids.map(id => byId.get(id)!.text), verifiedFindingIds: ids };
}
