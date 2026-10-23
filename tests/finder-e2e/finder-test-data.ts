import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import { fromGeojsonVt } from "@maplibre/vt-pbf";
import type { PowerFinderCollection } from "../../src/features/power-finder/fixture-data";

/** Fixed UI-test data only. Live release health is checked by check-production-map.mjs. */
export async function useBrandenburgViewport(page: Page) {
  await page.route("**/api/power-finder/viewport?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      path: "public/power-finder/brandenburg-osm.json",
    }),
  );
}

export async function useBrandenburgMapTiles(page: Page) {
  // Exercise actual vector-tile decoding and rendered layers, not a mocked map/counter.
  const collection = JSON.parse(readFileSync("public/power-finder/brandenburg-osm.json", "utf8"));
  const index = new GeoJSONVT(collection);
  await page.route("**/api/power-finder/tile/**", async (route) => {
    const url = new URL(route.request().url());
    const [z, x, y] = url.pathname.split("/").slice(-3).map(Number);
    const tile = url.searchParams.get("content") === "grid" ? index.getTile(z, x, y) : null;
    await route.fulfill({
      contentType: "application/vnd.mapbox-vector-tile",
      body: Buffer.from(fromGeojsonVt(tile ? { power_finder: tile } : {})),
    });
  });
}

export async function useSuccessfulEnrichment(page: Page) {
  await page.route("**/api/properties/enrich", async (route) => {
    const { properties, sources } = route.request().postDataJSON() as {
      properties: Array<{ propertyId: string }>;
      sources: string[];
    };
    await route.fulfill({
      json: {
        releaseFingerprint: "synthetic-browser-enrichment-v1",
        findings: [],
        sourceStatus: Object.fromEntries(sources.map((source) => [source, "succeeded"])),
        sourceResults: properties.flatMap(({ propertyId }) =>
          sources.map((source) => ({
            propertyId,
            source,
            status: "succeeded",
            findingCount: 0,
            releaseId: "synthetic-browser-enrichment-v1",
            checkedAt: "2026-07-23T00:00:00Z",
            limitation: "Synthetic test response; not site evidence.",
          })),
        ),
      },
    });
  });
}

export async function useOperatorContextViewport(page: Page) {
  await page.route("**/rest/v1/rpc/power_finder_public_operators", (route) =>
    route.fulfill({
      json: [
        {
          name: "wesernetz Bremen GmbH",
          type: "DSO / other",
          featureCount: 1,
          bounds: [8.5, 53.1, 8.7, 53.3],
          tsoNames: [],
        },
        {
          name: "TenneT TSO GmbH",
          type: "TSO",
          featureCount: 1,
          bounds: [8.5, 53.1, 8.7, 53.3],
          tsoNames: [],
        },
      ],
    }),
  );
  // Deliberately synthetic geometry and aliases exercise the real ranker and role resolver.
  const collection: PowerFinderCollection = {
    type: "FeatureCollection",
    metadata: {
      title: "Synthetic operator-context test",
      source_id: "browser-test",
      publisher: "GridPulse tests",
      licence: "Synthetic",
      attribution: "Synthetic test data",
      published_at: "2026-07-23T00:00:00Z",
      geographic_scope: "Synthetic Bremen test",
      freshness: "fixed",
      artifact_sha256: "a".repeat(64),
      record_count: 2,
      evidence_boundary: "Synthetic browser fixture; no capacity or operator evidence.",
    },
    features: [
      {
        type: "Feature",
        id: "test-dso",
        geometry: { type: "Point", coordinates: [8.58, 53.22] },
        properties: {
          kind: "node",
          name: "Rönnebeck",
          operator: "wesernetz",
          voltage_kv: [110],
          evidence_class: "test_fixture",
          capacity_state: "not_established",
        },
      },
      {
        type: "Feature",
        id: "test-tso",
        geometry: { type: "Point", coordinates: [8.59, 53.23] },
        properties: {
          kind: "node",
          name: "Umspannwerk Neuenkirchen",
          operator: "TenneT",
          voltage_kv: [220],
          evidence_class: "test_fixture",
          capacity_state: "not_established",
        },
      },
    ],
  };
  await page.route("**/api/power-finder/viewport?**", (route) =>
    route.fulfill({ json: collection }),
  );
}
