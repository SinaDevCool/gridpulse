import type { FinderProject } from "./finder-project";
import { finderSearchSchema, type FinderSearch } from "./search-contract";

export const candidateSearchReset: Partial<FinderSearch> = {
  q: undefined,
  voltage: undefined,
  operator: undefined,
  tso: undefined,
  dso: undefined,
  distance: 20,
  candidate: undefined,
  compare: undefined,
};

export function candidateSearchChips(search: FinderSearch, distance: number) {
  const chips: { key: keyof FinderSearch; label: string; patch: Partial<FinderSearch> }[] = [];
  if (search.q?.trim())
    chips.push({ key: "q", label: `Search: ${search.q}`, patch: { q: undefined } });
  if (search.voltage)
    chips.push({ key: "voltage", label: `${search.voltage}+ kV`, patch: { voltage: undefined } });
  for (const key of ["operator", "tso", "dso"] as const) {
    if (search[key] && search[key] !== "all")
      chips.push({
        key,
        label: `${key === "operator" ? "Operator" : key.toUpperCase()}: ${search[key]}`,
        patch: { [key]: undefined },
      });
  }
  if (distance !== 20)
    chips.push({ key: "distance", label: `Within ${distance} km`, patch: { distance: 20 } });
  return chips;
}

export const publicKeys = [
  "site",
  "q",
  "voltage",
  "operator",
  "tso",
  "dso",
  "sort",
  "resultsView",
  "tableColumns",
  "assetKind",
  "generationGroup",
  "assetMissing",
  "assetEvidence",
  "discoveryStrategy",
  "discoveryCount",
  "mapArea",
  "layers",
  "region",
  "mapMode",
  "mapView",
  "isolateVoltage",
  "isolateTechnology",
  "generationMinMw",
  "generationMaxMw",
  "storageMinMw",
  "storageMaxMw",
  "workflow",
] as const satisfies readonly (keyof FinderSearch)[];

/** A public screening configuration, never an export of the local site workspace. */
export function publicScreeningLink(origin: string, search: FinderSearch, project: FinderProject) {
  const url = new URL("/power-finder", origin);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid link origin");
  const filters = Object.fromEntries(publicKeys.map((key) => [key, search[key]]));
  const brief = {
    site: project.latitude == null && project.longitude == null ? ("none" as const) : undefined,
    lat: project.latitude ?? undefined,
    lng: project.longitude ?? undefined,
    mw: project.importMw,
    distance: project.maxDistanceKm,
    preferredVoltage: project.preferredVoltageKv ?? 0,
    projectType: project.type,
  };
  const validated = finderSearchSchema.parse({ ...filters, ...brief });
  if (search.mapArea !== undefined && validated.mapArea !== search.mapArea)
    throw new Error("Zoom to a map area within Germany before including the map area.");
  if (
    (brief.lat == null) !== (brief.lng == null) ||
    Object.entries(brief).some(
      ([key, value]) => value !== undefined && validated[key as keyof FinderSearch] !== value,
    )
  )
    throw new Error("Complete a valid screening brief before copying a link.");
  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.href;
}

/** Revalidate restored queries and retain only the same public configuration keys. */
export function publicFinderQuery(query: string) {
  if (query.length > 4096) throw new Error("Saved search is too large.");
  const raw = Object.fromEntries(new URLSearchParams(query));
  const parsed = finderSearchSchema.parse(raw);
  for (const key of ["lat", "lng", "mw", "distance", "preferredVoltage"] as const) {
    if (raw[key] !== undefined && parsed[key] === undefined)
      throw new Error("Saved search contains an invalid brief.");
  }
  if ((parsed.lat == null) !== (parsed.lng == null))
    throw new Error("Saved coordinates are incomplete.");
  if (parsed.site === "none" && parsed.lat != null)
    throw new Error("Saved site state is contradictory.");
  const keys = [
    ...publicKeys,
    "lat",
    "lng",
    "mw",
    "distance",
    "preferredVoltage",
    "projectType",
  ] as const;
  const result = new URLSearchParams();
  if (parsed.lat == null && parsed.site == null) result.set("site", "none");
  for (const key of keys) if (parsed[key] !== undefined) result.set(key, String(parsed[key]));
  return result.toString();
}
