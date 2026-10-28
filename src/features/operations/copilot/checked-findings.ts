import type { ConversationAnswer } from "./conversation-contracts";
/** Stable display identity only; assessment and corpus hashes supply provenance. */
function stableId(text: string) {
  let hash = 2166136261;
  for (const char of text)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `checked.${(hash >>> 0).toString(16)}`;
}
export function checkedFindings(answer: ConversationAnswer) {
  const ids = new Map<string, string>();
  return answer.blocks.map((checkedText, index) => {
    const guidance = answer.guidance?.find(
      (item) =>
        checkedText === `General guidance — ${item.title}: ${item.text}`,
    );
    const id = stableId(checkedText);
    if (ids.has(id) && ids.get(id) !== checkedText)
      throw new Error("Checked finding identity collision");
    ids.set(id, checkedText);
    return {
      id,
      checkedText,
      kind: guidance
        ? ("guidance" as const)
        : index === 0
          ? ("answer" as const)
          : ("evidence" as const),
      contextFactIds: guidance ? [] : answer.evidence.map((fact) => fact.id),
      guidanceRefs: guidance
        ? [{ id: guidance.id, revision: guidance.revision ?? guidance.version }]
        : [],
      mandatory: true as const,
      resultFingerprint: answer.receipt.resultFingerprint,
    };
  });
}
