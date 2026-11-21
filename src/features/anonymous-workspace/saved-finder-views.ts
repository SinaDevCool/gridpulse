export type SavedFinderView = {
  version: 1;
  id: string;
  name: string;
  search: string;
  createdAt: string;
  updatedAt?: string;
  release: string | null;
};

export function parseSavedFinderViews(value: unknown): SavedFinderView[] {
  if (!Array.isArray(value)) return [];
  const result: SavedFinderView[] = [];
  for (const entry of value.slice(0, 20)) {
    if (!entry || typeof entry !== "object") continue;
    const v = entry as Partial<SavedFinderView>;
    if (
      v.version !== 1 ||
      typeof v.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(v.id) ||
      typeof v.name !== "string" ||
      !v.name.trim() ||
      v.name.length > 80 ||
      typeof v.search !== "string" ||
      v.search.length > 4096 ||
      typeof v.createdAt !== "string" ||
      !Number.isFinite(Date.parse(v.createdAt)) ||
      (v.release !== null && (typeof v.release !== "string" || v.release.length > 160)) ||
      result.some((item) => item.id === v.id)
    )
      continue;
    result.push({
      version: 1,
      id: v.id,
      name: v.name.trim(),
      search: v.search,
      createdAt: v.createdAt,
      updatedAt:
        typeof v.updatedAt === "string" && Number.isFinite(Date.parse(v.updatedAt))
          ? v.updatedAt
          : v.createdAt,
      release: v.release ?? null,
    });
  }
  return result;
}
