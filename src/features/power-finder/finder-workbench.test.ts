import { describe, it, expect, vi } from "vitest";
import {
  candidateSearchChips,
  candidateSearchReset,
  publicScreeningLink,
} from "./finder-view-state";
import { finderSearchSchema } from "./search-contract";
import { defaultFinderProject } from "./finder-project";
import { emptyGermanyPowerFinderCollection } from "./fixture-data";
import { rankCandidatesForLocation } from "./candidate-intelligence";
import { selectFinderCandidate } from "./select-finder-candidate";
import { selectCandidates } from "./finder-selectors";
import { collectionPublicationDate } from "./source-provenance";

describe("public Finder workbench boundaries", () => {
  it("shares the current declared brief while dropping private and unknown URL fields", () => {
    const search = finderSearchSchema.parse({
      q: "Berlin",
      resultsView: "table",
      lat: 53,
      lng: 12,
      mw: 10,
      propertyId: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      capacitySource: "private",
      candidate: "private-candidate",
      compare: "private-comparison",
    });
    const project = {
      ...defaultFinderProject,
      latitude: 52.3,
      longitude: 13.4,
      importMw: 55,
      maxDistanceKm: 50,
      name: "Private client name",
    };
    const url = new URL(publicScreeningLink("https://gridpulseinsights.com", search, project));
    expect(url.pathname).toBe("/power-finder");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "Berlin",
      resultsView: "table",
      lat: "52.3",
      lng: "13.4",
      mw: "55",
      distance: "50",
    });
    for (const key of [
      "propertyId",
      "workspaceId",
      "capacitySource",
      "candidate",
      "compare",
      "name",
    ])
      expect(url.searchParams.has(key)).toBe(false);
    expect(url.href).not.toContain("Private");
  });
  it("refuses invalid or half-entered brief coordinates instead of sharing a different search", () => {
    expect(() =>
      publicScreeningLink("https://example.com", finderSearchSchema.parse({}), {
        ...defaultFinderProject,
        latitude: 52,
        longitude: null,
      }),
    ).toThrow();
    expect(() =>
      publicScreeningLink("https://example.com", finderSearchSchema.parse({}), {
        ...defaultFinderProject,
        importMw: Infinity,
      }),
    ).toThrow();
    expect(() =>
      publicScreeningLink("https://example.com", finderSearchSchema.parse({}), {
        ...defaultFinderProject,
        latitude: 90,
        longitude: 13,
      }),
    ).toThrow();
  });
  it("normalises invalid presentation state and does not resurrect hidden capacity parameters", () => {
    expect(finderSearchSchema.parse({ resultsView: "unsupported" }).resultsView).toBeUndefined();
    const link = publicScreeningLink(
      "https://example.com",
      finderSearchSchema.parse({
        mapMode: "capacity",
        capacitySource: "demo",
        study: "activation",
      }),
      defaultFinderProject,
    );
    expect(link).not.toContain("capacity");
    expect(link).not.toContain("activation");
  });
  it("removes an individual search facet without changing the declared brief or layers", () => {
    const search = finderSearchSchema.parse({
      q: "Berlin",
      voltage: 110,
      tso: "Example TSO",
      lat: 52,
      lng: 13,
      mw: 55,
      mapView: "generation",
    });
    const chips = candidateSearchChips(search, 50);
    const voltage = chips.find((chip) => chip.key === "voltage")!;
    expect({ ...search, ...voltage.patch }).toMatchObject({
      q: "Berlin",
      tso: "Example TSO",
      lat: 52,
      lng: 13,
      mw: 55,
      mapView: "generation",
      voltage: undefined,
    });
    expect({ ...search, ...candidateSearchReset }).toMatchObject({
      lat: 52,
      lng: 13,
      mw: 55,
      mapView: "generation",
      distance: 20,
      q: undefined,
      tso: undefined,
    });
  });
});

it("the evidence summary never promotes a query timestamp or invalid date to source publication", () => {
  const collection = emptyGermanyPowerFinderCollection();
  collection.metadata.published_at = "2026-11-21T16:00:00Z";
  collection.metadata.published_at_basis = "query_time";
  expect(collectionPublicationDate(collection)).toBeNull();
  collection.metadata.published_at_basis = "source_release";
  expect(collectionPublicationDate(collection)).toBe("2026-11-21T16:00:00Z");
  collection.metadata.published_at = "unknown";
  expect(collectionPublicationDate(collection)).toBeNull();
});

function fixture() {
  const collection = emptyGermanyPowerFinderCollection();
  collection.features = ["Zulu", "Alpha"].map((name, index) => ({
    type: "Feature",
    id: `node-${index}`,
    geometry: { type: "Point", coordinates: [13 + index * 0.01, 52] },
    properties: { kind: "node", name, voltage_kv: [110], evidence_class: "open_mapping" },
  }));
  return { collection, ranking: rankCandidatesForLocation(collection, 13, 52, 55, 20) };
}
it("card/table selection uses real node geometry and the same public candidate identity", async () => {
  const { collection, ranking } = fixture();
  const candidate = ranking.candidates[0];
  const model = {
    collection,
    rankingCollection: collection,
    setSelected: vi.fn(),
    setSelectedOpportunitySnapshot: vi.fn(),
    navigateMapToPoint: vi.fn(),
    setInteractionNotice: vi.fn(),
    updateSearch: vi.fn().mockResolvedValue(undefined),
  };
  await selectFinderCandidate(model, candidate);
  expect(model.updateSearch).toHaveBeenCalledWith({ candidate: candidate.id });
  expect(model.navigateMapToPoint).toHaveBeenCalledWith([13, 52]);
  expect(model.setSelected.mock.calls[0][0].id).toBe(candidate.nodeId);
  model.collection = emptyGermanyPowerFinderCollection();
  model.rankingCollection = emptyGermanyPowerFinderCollection();
  vi.clearAllMocks();
  await selectFinderCandidate(model, candidate);
  expect(model.navigateMapToPoint).not.toHaveBeenCalled();
  expect(model.updateSearch).not.toHaveBeenCalled();
  expect(model.setSelected).not.toHaveBeenCalled();
  expect(model.setInteractionNotice).toHaveBeenCalledWith(
    expect.stringContaining("geometry is unavailable"),
  );
});
it("the shared name sort orders the displayed candidate name before its site name", () => {
  const { collection, ranking } = fixture();
  ranking.candidates.forEach((c) => {
    c.siteName = c.nodeName === "Alpha" ? "Zulu site" : "Alpha site";
  });
  const result = selectCandidates({
    collection,
    rankingCollection: collection,
    ranking,
    query: "",
    minimumVoltage: 0,
    selectedDso: "all",
    selectedTso: "all",
    operatorCatalog: [],
    mapMode: "voltage",
    activeCapacityNodes: [],
    capacityMetric: "firm_import_mw",
    requiredCapacityMw: 55,
    candidateSort: "name",
  });
  expect(result.items.map((c) => c.nodeName)).toEqual(["Alpha", "Zulu"]);
});
