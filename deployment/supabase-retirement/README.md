# Finder source-copy retirement — 22 November 2026

The public Finder runs on the activated Neon snapshot `finder-public-20261121-v1` in both production and staging. Supabase still provides Auth for public calculation/copilot sessions and retains analytics and Operations data.

The one-time SQL in this directory clears only `public.canonical_energy_assets` and `public.canonical_grid_lines` in production project `csdsquchhhwvvtleiyuy`. It is an execution record, **not a replayable schema migration**. Its counts and transaction-version guards intentionally fail if replayed or if the source changes. Do not add it to the normal migration chain.

## Storage result

| Measurement | Before | After |
| --- | ---: | ---: |
| All database sizes, bytes | 1,080,785,617 | 439,745,233 |
| Main database, bytes | 1,065,670,323 | 424,629,939 |
| Energy-asset rows | 640,724 | 0 |
| Grid-line rows | 123,974 | 0 |

The operation reclaimed 641,040,384 bytes and brought measured usage below the 500 MB free-plan limit. Dashboard accounting can update later than the PostgreSQL measurement.

## Admission and retained data

- Verified all 123 full-source archive batches against source SHA256 values, row counts, UUID ordering and unique IDs. Geometry is lossless EWKB hex; every other original column is preserved.
- Compared ordered row fingerprints in all 32 UUID ranges with the source and verified unchanged row counts/transaction versions throughout the comparison.
- Verified the separate public-projection recovery archive: 654,267 features, with the expected per-kind counts. Both Neon reader environments remain configured; production active-snapshot counts were checked directly.
- Checked inbound foreign keys and user triggers before acquiring exclusive locks. Both counts were zero. The SQL rechecks these dependencies and source versions under the lock and uses `TRUNCATE` without `CASCADE`.
- Preserved table definitions, source/artifact/release parents, nodes, industrial sites, context observations, existing materialized views, Auth and analytics jobs. Health advisors were clear before and after the operation. Paused Supabase staging was not resumed or modified.

Immediately after cleanup, retained counts were unchanged: 131 Auth users, 141 sessions, 128 analytics jobs, 105,453 nodes, 60,845 industrial sites and 130,865 context observations. Subsequent smoke tests can add anonymous sessions and calculation jobs.

## Recovery

The private recovery set is `supabase-cleanup-20261122/full-source`; data is deliberately excluded from Git. Its `manifest.json` SHA256 is `908471562ca7b927b0a1fd98fc80527d6d00c3b5947a87a8e0c628fc1e6bbdc3`. It contains the complete original rows, schema metadata, source fingerprints, verification script and before/after measurements. The existing public-only Neon archive is insufficient to restore the extra source metadata or superseded rows.

To recover, verify the manifest and every batch, then use an authorised database client with parameterised JSON to populate the retained table row types:

```sql
-- $1 is one verified JSON array, supplied as a parameter by the client.
insert into public.canonical_energy_assets
select * from jsonb_populate_recordset(null::public.canonical_energy_assets, $1::jsonb);
-- Use the corresponding retained row type for canonical_grid_lines.
```

Use bounded batches and a transaction; do not paste archive data into executable SQL. The PostGIS geometry input accepts the stored EWKB hex. Read-only source-row round-trip checks covered scalar fields and geometry before retirement. Preserve the source/artifact/release parents because restored rows reference them. A complete restore also restores the old storage consumption, so establish sufficient capacity before doing it.

The legacy Supabase viewport/tile/enrichment and refresh routines retain their definitions, but these two raw datasets are empty. Do not switch the public provider back to Supabase or refresh legacy materialized views expecting these source rows without recovery/reingestion. Future Finder ingestion should publish to the governed Neon snapshot pipeline. No application deployment or billing change is required for this data-only cleanup.
