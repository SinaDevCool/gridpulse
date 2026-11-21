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

const publicKeys = [
  "q",
  "voltage",
  "operator",
  "tso",
  "dso",
  "sort",
  "resultsView",
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
    lat: project.latitude ?? undefined,
    lng: project.longitude ?? undefined,
    mw: project.importMw,
    distance: project.maxDistanceKm,
    preferredVoltage: project.preferredVoltageKv ?? undefined,
    projectType: project.type,
  };
  const validated = finderSearchSchema.parse({ ...filters, ...brief });
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
