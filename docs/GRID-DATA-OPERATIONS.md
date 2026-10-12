# Grid data operations

## Release states

`started → downloaded → parsing → staged → validating → published`

Any run can instead become `failed` or `rejected`. A dataset release becomes visible only after
its validation report has `valid=true` and the service-role-only activation function succeeds.
The previously active release becomes `superseded` in the same database transaction.

## MaStR daily operation

1. Run `grid-data check-mastr` and compare URL, ETag, Last-Modified and content length.
2. If unchanged, finish without downloading.
3. Download to a `.part` file and resume with HTTP Range after interruption.
4. Calculate SHA-256 and preserve the source manifest.
5. Stream only relevant electrical-unit XML members and resolve MaStR catalogue identifiers.
6. Filter the accepted geographic scope.
7. Quarantine malformed coordinates; retain assets whose location is municipality-only.
8. Stage rows against a non-active dataset release.
9. Reconcile staged and parsed record counts.
10. Activate the release.
11. Refresh node/radius metrics in batches of 25 nodes through
    `refresh_grid_node_asset_context_batch`; each batch remains below the API timeout.

## Rollback

Rollback is a database operation, not a file overwrite:

1. Select the most recent valid `superseded` release for the source.
2. Mark the current release `rolled_back`.
3. Mark the selected release `active`.
4. Refresh spatial metrics.
5. Record the reason and operator in the validation report.

Do not delete ingestion history or source artifacts during rollback.

## Failure rules

- A changed XML schema fails before publication.
- An empty geographic extract is rejected.
- A record-count mismatch is rejected.
- Unknown catalogue values are retained as unknown and reported.
- Invalid coordinates do not become map points.
- Missing capacity evidence remains `not established`; it never becomes zero.
- Registered unit MW is asset context, never connection headroom.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` is required only by the trusted batch publisher. It must not use a
`VITE_` prefix, enter browser bundles, appear in command output, or be committed. Raw artifacts
belong in private object storage with checksums and retention controls.

## External operational gate

Cloudflare R2 is not enabled on the current Cloudflare account. Enable it in the Cloudflare
dashboard before creating the `gridpulse-grid-artifacts` bucket. This may require accepting
Cloudflare billing terms and cannot be completed safely by application code.

## Current official release

- Scope: Germany-wide exact public generation and storage locations
- Source publication: 2026-08-10, MaStR export version 26.1
- Compressed bytes: 3,130,298,194
- SHA-256: `e8f2203b90e77f1a52b5be82c18cb11b6358fc27c1acd0f7e4e794c78e8b8b1c`
- Parsed and published map rows: 364,663
- Exact generation locations: 357,703
- Exact storage locations: 6,960
- Active release: `94ce31d6-3b18-4d81-a301-8503f77b586c`

The accepted national map release retains only generation and storage units with public exact
coordinates. Municipality-only and withheld locations remain absent rather than being placed at
invented coordinates. The bundled OSM fallback remains the south-Berlin/Brandenburg pilot and is
used only when the live national API is unavailable.

## National OSM operation

1. Discover the 14 state extracts with `discover-geofabrik-states`.
2. Download each PBF with resumable `.part` handling and retain its manifest.
3. Verify the advertised MD5 before parsing; a mismatch stops the state run.
4. Stream nodes, ways and assembled multipolygons with `parse-osm-pbf`.
5. Review the rejected-record NDJSON and mandatory validation gates.
6. Generate COPY files with `write-osm-copy`; do not generate per-row migrations.
7. Stage into the existing canonical tables under a non-active artifact/release.
8. Validate counts, geometry, boundaries, duplicates, metadata and GiST indexes.
9. Aggregate accepted state reports and atomically activate through existing release governance.
10. Project only accepted topology and release lineage to Neo4j, then reconcile counts and IDs.

The national CI workflow deliberately fails at staging if immutable artifact storage or batch
database credentials are absent. That failure is truthful: fixtures and the Brandenburg artifact
are never promoted as Germany-wide coverage.
