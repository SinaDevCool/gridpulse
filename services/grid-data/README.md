# GridPulse grid-data service

This package is the ingestion boundary for public geospatial screening data. It does not
calculate or confirm connection capacity.

The service includes a deterministic synthetic fixture for isolated tests and a bounded
OpenStreetMap connector for real substations, lines, cables, and industrial land.

The OSM connector uses Overpass for bounded pilot releases. A national production refresh should
download the appropriate Geofabrik `.osm.pbf` extract once, retain it as an immutable raw artifact,
and run equivalent parsing in batch infrastructure instead of issuing many Overpass queries.

The MaStR connector streams the official XML full-export ZIP and emits canonical generation,
storage, and consumption asset context. The official archive is roughly 3 GB compressed, so it is
not downloaded during a web request, application build, or normal test run.

## Run

```powershell
python -m unittest discover -s tests
python -m grid_data.cli build-fixture `
  --input tests/fixtures/brandenburg-screening-source.json `
  --output ../../public/power-finder/brandenburg-screening.json
python -m grid_data.cli fetch-osm `
  --bbox 52.22,13.15,52.40,13.55 `
  --endpoint https://overpass.kumi.systems/api/interpreter `
  --output ../../public/power-finder/brandenburg-osm.json
python -m grid_data.cli write-sql `
  --input ../../public/power-finder/brandenburg-osm.json `
  --output releases/brandenburg-osm-load.sql
python -m grid_data.cli check-mastr `
  --output D:\grid-data\mastr-source-health.json
python -m grid_data.cli download `
  --url https://download.marktstammdatenregister.de/Gesamtdatenexport_YYYYMMDD_VERSION.zip `
  --output D:\grid-data\mastr-public-export.zip
python -m grid_data.cli stream-mastr `
  --input D:\grid-data\mastr-public-export.zip `
  --output D:\grid-data\mastr-brandenburg.ndjson `
  --federal-state Brandenburg
$env:SUPABASE_URL = "https://PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<server-side secret>"
python -m grid_data.cli publish-mastr `
  --input D:\grid-data\mastr-brandenburg.ndjson
python -m grid_data.cli fetch-operator-evidence `
  --output D:\grid-data\operator-evidence-health.json
python -m grid_data.cli propose-operator-matches `
  --input D:\grid-data\50hertz-node-records.json `
  --output D:\grid-data\50hertz-match-proposals.json
python -m grid_data.cli validate-operator-import `
  --input D:\grid-data\operator-record-manifest.json `
  --output D:\grid-data\operator-record-validation.json
```

Run these commands from `services/grid-data` with `PYTHONPATH=src`, or install the package:

```powershell
python -m pip install -e .
```

## Production boundary

- Browser and Worker code read published artifacts or Supabase rows.
- Long-running ingestion runs outside the Cloudflare request path.
- Service-role credentials are server-side secrets and never browser variables.
- A source is promoted only after validation.
- MaStR is parsed into newline-delimited records so the 3 GB archive is never accumulated in
  memory.
- Publication uses a staging release. Authenticated users see its assets only after record-count
  validation and atomic activation.
- Failed ingestion runs and rejected releases remain auditable and cannot replace the active
  release.
- `.github/workflows/grid-source-health.yml` checks the currently advertised export each day
  without downloading the archive.
- Overpass and Geofabrik data are OpenStreetMap data under ODbL; attribution must remain visible.
- OpenStreetMap establishes mapped context only. It never establishes available connection MW.
- MaStR unit MW describes registered generation, storage, or consumption assets. It is not grid
  headroom and must never be displayed as available connection capacity.
- Operator pages are snapshotted for provenance and change detection. The connector deliberately
  emits no numeric capacity observation until an explicit value, demand direction, reuse right,
  and reviewed node identity are all established.
- The E.DIS public Netzanschlussmonitor is generation-oriented context, not demand headroom.
- Operator node matching emits proposals only. Name, voltage, operator, and distance contribute to
  confidence, but an authenticated reviewer must accept a match before it becomes user-visible.
- Operator record imports require an explicit reuse basis, HTTPS evidence, and permission for
  redistribution. A publicly viewable map is not treated as permission to republish its records.

Cloudflare R2 is the preferred immutable artifact store, but the account must have R2 enabled
before the archive can be uploaded. The database stores its checksum and release history
independently, so lack of R2 never relaxes validation or evidence boundaries.
