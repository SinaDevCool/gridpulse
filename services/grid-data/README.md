# GridPulse grid-data service

This package is the ingestion boundary for public geospatial screening data. It does not
calculate or confirm connection capacity.

The service includes a deterministic synthetic fixture for isolated tests and a bounded
OpenStreetMap connector for real substations, lines, cables, and industrial land.

The OSM connector uses Overpass for bounded pilot releases. A national production refresh should
download the appropriate Geofabrik `.osm.pbf` extract once, retain it as an immutable raw artifact,
and run equivalent parsing in batch infrastructure instead of issuing many Overpass queries.

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
- Overpass and Geofabrik data are OpenStreetMap data under ODbL; attribution must remain visible.
- OpenStreetMap establishes mapped context only. It never establishes available connection MW.
