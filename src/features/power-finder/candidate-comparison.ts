export const MAX_COMPARED_CANDIDATES = 5;

export function parseComparison(value?: string): string[] {
  return Array.from(new Set((value ?? "").split(",").filter(Boolean))).slice(
    0,
    MAX_COMPARED_CANDIDATES,
  );
}

export function addComparisonCandidate(ids: string[], id: string) {
  if (ids.includes(id)) return { ids, limitReached: false };
  if (ids.length >= MAX_COMPARED_CANDIDATES) return { ids, limitReached: true };
  return { ids: [...ids, id], limitReached: false };
}

export function removeComparisonCandidate(ids: string[], id: string) {
  return ids.filter((candidateId) => candidateId !== id);
}

export function serializeComparison(ids: string[]) {
  return ids.length ? ids.join(",") : undefined;
}
