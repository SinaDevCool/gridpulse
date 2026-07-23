# Power Finder production milestone

## Outcome

Power Finder is a private, evidence-aware screening map connected to GridPulse's assessment
workflow. It ships with a real, bounded OpenStreetMap release for southern Berlin/Brandenburg and
retains a deterministic synthetic dataset for isolated tests. Neither dataset is presented as
hosting-capacity evidence.

## Architecture

1. `services/grid-data` downloads and validates versioned geospatial artifacts.
2. Source identity, checksum, licence, parser version, freshness, and validation state are retained.
3. Canonical nodes, lines, and industrial sites live in PostGIS with source provenance.
4. `power_finder_viewport` returns at most 5,000 classified GeoJSON features inside a bounding box
   and is executable only by authenticated users.
5. Before the database release is loaded, the browser uses the accepted static OSM artifact.
6. MapLibre renders the result and links selected nodes into `/assessments/new`.
7. Assessment creation, evidence review, scenarios, and reports remain the decision workflow.

Long-running extraction and spatial processing do not run in a Cloudflare Worker request. Run the
Python pipeline in CI, a scheduled job, or dedicated batch compute. The Worker serves the web app
and performs only bounded Supabase operations. This follows current Cloudflare guidance on moving
background work off the request path.

## Evidence rules

- `official_operator`: published by the responsible network operator.
- `official_regulatory`: published by the responsible regulator.
- `official_public`: published by another identified public authority.
- `open_mapping`: community-maintained mapped context, including OpenStreetMap.
- `test_fixture`: synthetic development and test data.
- Unknown capacity stays unknown; it is never converted to zero or inferred from map appearance.
- Every capacity value retains observation type, publication date, grade, and caveats.
- A map result is not a connection offer, reservation, feasibility approval, cost, or delivery date.

## Real OSM release

The pilot connector sends one bounded Overpass query for:

- `power=substation`;
- `power=line`, `power=minor_line`, and `power=cable`;
- `landuse=industrial`.

It normalises voltage values, preserves raw tags and OSM record links, attaches ODbL attribution,
hashes the raw response and accepted GeoJSON, and labels every feature `open_mapping`.

Overpass is appropriate for a bounded pilot. Germany-wide production refreshes should download a
Geofabrik `.osm.pbf` extract once and process it in batch infrastructure. Do not tile Germany into
large numbers of Overpass requests.

## Local runbook

```powershell
python -m pip install -e .\services\grid-data
npm run grid:test
npm run grid:fetch:brandenburg
npm run grid:write-sql
npm install
npm run dev
```

Sign in and open `/power-finder`. Selecting a node shows provenance, the transparent context score,
and a link that prefills a new assessment with its coordinates.

## Confirmed-staging rollout

Do not run these steps against an ambiguously linked project.

1. Confirm the Supabase project reference is staging.
2. Take a schema backup and record the current migration list.
3. Apply, in order:
   - `20260723090000_power_finder_spatial_foundation.sql`
   - `20260723100000_power_finder_viewport_api.sql`
4. Execute `services/grid-data/releases/brandenburg-osm-load.sql` with a staging database connection.
5. Confirm 668 accepted source features for the current release.
6. Sign in and confirm the UI reports `bounded database query`, not `accepted static release`.
7. Test RLS with anonymous and authenticated sessions.
8. Promote only after source, licence, geometry, and product-truth review.

Service-role and database credentials belong only in trusted server-side secret stores.

## Current deployment

On 2026-07-23, the repository's linked `GridPulse Nexus` Supabase project was explicitly approved
as the target and received all three Power Finder migrations. The accepted release contains:

- 293 canonical grid nodes;
- 233 canonical grid corridors;
- 142 canonical industrial sites;
- 668 total viewport features;
- one active, checksum-addressed source artifact.

Anonymous calls to `power_finder_viewport` return HTTP 401. Authenticated calls return the bounded
feature collection with its evidence boundary. Cloudflare Worker version
`aa9c8e4b-1964-45f5-b755-cc885ba663d1` was deployed to both the workers.dev endpoint and the
configured `gridpulseinsights.com` domain.

## Screening context score

The 0–100 score measures data completeness and authority:

- voltage context: 35 points;
- source authority: 25 points;
- operator identity: 15 points;
- mapped operational context: 10 points;
- classified published demand-capacity evidence: 15 points.

Unknown capacity receives zero capacity points. The score is not a connection probability,
available-MW estimate, operator preference, cost estimate, or energisation forecast.

## Connector roadmap

1. OSM bounded pilot: complete.
2. Geofabrik national PBF batch path: next scale step.
3. Marktstammdatenregister generation and storage assets.
4. BNetzA and TSO plans, projects, substations, and operator boundaries.
5. DSO CSV, XLSX, WFS, ArcGIS, and PDF capacity publications.
6. Fibre, roads, rail, water, land constraints, and protected areas.

Every connector follows: discover, download immutable raw artifact, checksum, stage, validate CRS
and fields, deduplicate, resolve canonical identities, classify evidence, approve, promote, and
publish. Failed validation leaves the last accepted release active.

## Acceptance checks

```powershell
npm run check:encoding
npm run grid:test
npm run typecheck
npm run test
npm run build
npm run test:e2e
git diff --check
```

Before displaying a new capacity source, add connector contract tests, licence review, freshness
alerts, row-count and geometry-quality thresholds, and human approval of the evidence classification.
