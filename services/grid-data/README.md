# GridPulse grid-data service

The internal P0–P4 permutation, ensemble, surrogate and active-learning pipeline is documented in `../../docs/POWER-FINDER-P0-P4.md`. It remains synthetic or operator-model-unvalidated until the validation ladder is completed.

This package is the ingestion boundary for public geospatial screening data. It does not
calculate or confirm connection capacity.

Release C1 also contains a separate, validation-classed electrical study boundary. It can run
real AC power flow on explicit SimBench or CGMES parameters, but benchmark and unreviewed-model
results are never promoted to confirmed location capacity.

Release C2 adds versioned SMARD and DWD hourly ingestion, MaStR aggregation, multiple weather-year
operating cases and AC-derived P10/P50/P90 envelopes. Public data remains contextual and benchmark
results remain `synthetic_demonstration` until a reviewed operator model is linked.

The service includes a deterministic synthetic fixture for isolated tests and a bounded
OpenStreetMap connector for real substations, lines, cables, and industrial land.

The OSM connector uses Overpass for bounded pilot releases. A national production refresh should
uses the official bounded Geofabrik state extracts, verifies every advertised MD5, retains each
raw artifact immutably, and streams it with pyosmium. Fourteen extracts cover the 16 Länder because
Bremen is bundled with Niedersachsen and Saarland with Rheinland-Pfalz. State releases can be
retried independently and are combined only after every supplied state report is accepted.

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
python -m grid_data.cli discover-geofabrik-states `
  --output D:\grid-data\geofabrik-states.json
python -m grid_data.cli download `
  --url https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf `
  --output D:\grid-data\berlin.osm.pbf
python -m grid_data.cli parse-osm-pbf `
  --input D:\grid-data\berlin.osm.pbf `
  --output D:\grid-data\berlin.ndjson `
  --expected-md5 <value-from-manifest> `
  --geographic-scope Berlin
python -m grid_data.cli write-osm-copy `
  --input D:\grid-data\berlin.ndjson `
  --output-dir D:\grid-data\berlin-copy
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
python -m grid_data.cli publish-operator-health `
  --input D:\grid-data\operator-evidence-health.json
python -m grid_data.cli validate-c1-benchmark `
  --output ../../public/power-finder/c1-benchmark-validation.json
python -m grid_data.cli validate-benchmark-a `
  --output ../../output/benchmark-a.json
python -m grid_data.cli validate-benchmark-b `
  --output ../../output/benchmark-b.json
python -m grid_data.cli validate-benchmark-c `
  --output ../../output/benchmark-c.json
python -m grid_data.cli validate-benchmark-d `
  --output ../../output/benchmark-d.json
python -m grid_data.cli validate-benchmark-e `
  --output ../../output/benchmark-e.json
python -m grid_data.cli publish-c1-benchmark `
  --input ../../public/power-finder/c1-benchmark-validation.json
python -m grid_data.cli validate-c2-benchmark `
  --output ../../public/power-finder/c2-hourly-benchmark.json
python -m grid_data.cli publish-c2-benchmark `
  --input ../../public/power-finder/c2-hourly-benchmark.json
```

`validate-benchmark-a` is the reproducible open-network solver-consistency gate described in
`../../docs/BENCHMARK-A.md`. Its result is validation evidence only; it is never published as
location capacity.

`validate-benchmark-b` is the independent-solver gate described in `../../docs/BENCHMARK-B.md`.
It compares pandapower Newton–Raphson with standalone PYPOWER fast-decoupled XB while retaining the
same model conversion and capacity search. It is also validation evidence, never location capacity.

`validate-benchmark-c` is the operator-reference reconciliation gate described in
`../../docs/BENCHMARK-C.md`. Without supplied operator evidence it runs only the bundled synthetic
rehearsal and must report `operator_validation_passed=false`.

`validate-benchmark-d` is the capacity-outcome backtest described in `../../docs/BENCHMARK-D.md`.
It gives unsafe capacity overstatement a zero-tolerance acceptance gate and requires signed,
operator-approved outcomes before setting `operator_outcome_validation_passed=true`.

`validate-benchmark-e` is the prospective holdout protocol described in
`../../docs/BENCHMARK-E.md`. It rejects prediction/outcome time leakage and requires uncertainty
calibration plus a one-sided confidence bound on the unsafe-overstatement rate.

Run these commands from `services/grid-data` with `PYTHONPATH=src`, or install the package:

```powershell
python -m pip install -e .
```

## Production boundary

- Browser and Worker code read published artifacts or Supabase rows.
- Germany-wide query and vector-tile capability does not imply Germany-wide accepted coverage.
  `/rpc/power_finder_public_coverage` is authoritative and reports `partial` or `unavailable`
  until a governed national aggregate is active.
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
- Source checks can be persisted with server-side Supabase credentials. Checksum changes create
  review alerts; they never alter node identity or capacity automatically.

Cloudflare R2 is the preferred immutable artifact store, but the account must have R2 enabled
before the archive can be uploaded. The database stores its checksum and release history
independently, so lack of R2 never relaxes validation or evidence boundaries.

Release 3 adds private surrogate shadow validation, drift monitoring, explainability, and a
fail-closed champion ledger. Run `npm run grid:validate:r3` from the repository root. Synthetic
benchmarks must remain challengers; only the protected operator-review workflow may approve an
internal scenario-prioritisation champion, and it never creates a capacity claim.
