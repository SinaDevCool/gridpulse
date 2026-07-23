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

- Scope: Brandenburg electrical assets
- Source publication: 2026-07-23, MaStR export version 26.1
- Compressed bytes: 3,099,107,513
- SHA-256: `e7279576bd901eae26490e942687dc6361e171f43ec452a24cca048b94c249e3`
- Parsed and published rows: 290,957
- Exact public coordinates: 14,962
- Active release: `7432f187-4bda-45f6-bad9-8b1069992b6a`
