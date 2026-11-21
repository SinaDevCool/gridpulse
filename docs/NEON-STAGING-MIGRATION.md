# Free-tier Finder staging migration

Target: Neon `gridpulse-staging`, Frankfurt, PostgreSQL 17, project
`icy-bread-85526938`, branch `br-curly-rain-bhk2vlwy`. Source: the published public
projection in Supabase `csdsquchhhwvvtleiyuy`. The inactive Supabase staging
project is not resumed or modified. Production stays on Supabase.

## Measurements and scope

Read-only inspection on 21 November 2026 measured the source database at
1,065,531,059 bytes, including 1,037,991,936 bytes of public relations. A full
clone would leave almost no room under Neon's 1 GiB branch limit. It would
also copy unrelated and private application state unnecessarily.

Only two active, accepted public releases are admitted:

| Release | Identifier | Included records |
| --- | --- | --- |
| Geofabrik / OSM Germany | `40daf143-2b0b-4f7b-933d-0efc48ca4649` | 105160 nodes, 123741 lines, 60703 industrial sites |
| BNetzA / MaStR | `94ce31d6-3b18-4d81-a301-8503f77b586c` | 357703 mapped generation and 6960 mapped storage assets |

Total: 654267 published features. Preserve source identifiers, original geometry,
source attribution/licences, release IDs and actual source publication dates.
Exclude superseded/legacy duplicates, private workspaces, auth records, raw
source metadata, unrelated observations and application job history. BKG is not
copied and must not appear as a migrated coverage release. Published study
responses are copied only through the existing public, review-gated functions;
no private electrical models or raw facility data are admitted.

## Execution and acceptance

1. Export immutable public batches to ignored local migration storage, with a
   manifest, byte hashes, row hashes, source release IDs and expected counts.
   These files back up the migrated public projection, not the whole production
   database. Source reads are bounded and sequential. Compare source release
   status/count/update fingerprints before and after export; reject a changing
   source. Do not claim a cross-call PostgreSQL transaction snapshot.
2. Create a dedicated Neon schema. Load an inactive snapshot idempotently;
   verify every row's payload/geometry hash and all layer counts. Abort before
   activation if storage exceeds the local safety budget. Preserve the source
   database without writes or billing changes.
3. Give the Worker a dedicated read-only role restricted to the public schema
   and active snapshot. Keep its connection credential in staging secrets only;
   never put it in Vite variables, client assets or source control.
4. Preserve the same public API boundaries for viewport, candidate retrieval,
   map tiles, coverage, operator catalogue and published study responses. Select
   the Neon provider only for staging. Production defaults remain unchanged.
   Use parameterised, fixed SQL operations; failures stay unavailable and never
   fall through to the production database.
5. Validate query/tile parity, public provenance, imported counts, permissions,
   restore hashes, failure states, secret exclusion, asset budgets and the
   browser investigation workflow. Keep all local heavy checks sequential.
6. Publish through normal PR/CI/exact-artifact staging release gates. Verify the
   live commit, actual uncached tiles and the real candidate/enquiry/receipt
   workflow before handing over the preview.

## Backups, rollback and limits

Keep the exported batches and manifest outside the public bundle. A restore
loads a fresh inactive snapshot and repeats row/count/hash qualification before
activating it. Never delete source history or copy private data to public assets.

Rollback uses the preceding staging Worker version/provider configuration and
retains the Neon snapshot and source database. The preceding Supabase staging
origin is inactive: rollback restores the known application/fallback behaviour,
not a claim that its tile service becomes healthy. Production promotion requires
review of the staging result and a separate authorised switch.

Neon remains Free; no paid plan, R2 subscription or new paid service is enabled.
This is a bounded snapshot/read-model migration, not unlimited free hosting.
Future ingestion needs an explicit refresh/revalidation run and storage/compute
budget checks. Physical calculation and optimisation remain owned by the
existing analytical service.

## Completed snapshot qualification — 21 November 2026

- Loaded 654267 records from 199 backed-up batches. Counts match every admitted
  layer: 105160 nodes, 123741 lines, 60703 sites, 357703 generation and 6960 storage.
- Recomputed all stored geometry/property hashes: zero mismatches. All source
  geometries are valid and non-empty; none were repaired or silently dropped.
- Preserved source operational status using a separately checksummed supplement:
  23445 planned, construction or out-of-service exceptions; other admitted
  infrastructure/assets are operational, and industrial-site status stays unknown.
  Restored status SHA-256 matches the source payload:
  `328d56b361ee88b7abd055b4332009c4369bc18c049b2f0eb01a2a19ba4fa9d5`.
- Each global registry overview at zoom 4–7 accounts for all 364663 registry assets.
  Missing MW stays null; known-value counts accompany registered MW aggregates.
- Source counts, last-seen values, release acceptance and artifact hashes matched
  before/after. These are bounded sequential public reads, not an atomic full
  database dump.
- Verified the complete backup using `restore-neon-public.mjs verify`.
  The initial import itself loaded these backed-up batches and passed every
  target row hash. A separate clean-database disaster-recovery drill was not run.
- Activated snapshot `finder-public-20261121-v1` with data-manifest SHA-256
  `b11fd6fa698f3743b47c3e2bd516670e279368cf38c7be507c5b03da856098ed`.
  Measured database size at activation: 535773184 bytes, about 511 MiB.

Backups are ignored local files under
`.codex-tmp/neon-migration/finder-public-20261121-v1/`, including source checks,
metadata, status supplement, batch checksums and manifest. Keep this folder
when cleaning task artifacts. It contains only the admitted public projection.
The manifest records the import-time DDL hashes; subsequent query qualification
corrected PostGIS operator qualification and the access/index execution policy.
Restore with the reviewed current DDL, in order: `schema.sql`, `overview.sql`,
`status.sql`, then the separately provisioned reader's `reader-grants.sql`.
The restore CLI verifies all data before writes, refuses an existing snapshot,
and never activates traffic automatically.
Refresh planner statistics after bulk load and again after activation:
`ANALYZE finder_public.features, finder_public.operational_status,
finder_public.registry_overview, finder_public.snapshots, finder_public.active_snapshot`.
The national grid-tile query was measured with EXPLAIN ANALYZE at about 3.13 s
on the fixed 0.25-CU compute after qualification and statistics refresh.

### App access and spatial-index qualification

The app role has no administrator membership, create-role/database rights,
RLS bypass or write grants. It cannot read import logs or raw feature/status/
overview tables. It has an eight-second statement limit and read-only default.
Metadata reads see the active snapshot only.

EXPLAIN showed that invoker RLS execution prevented the PostGIS GiST index from
serving the spatial predicate and caused tile timeouts. The viewport and tile
functions therefore use SECURITY DEFINER with an empty search path, qualified
operators/functions, fixed SELECT statements, bounded parameters and mandatory
active-snapshot joins. They are STABLE, contain no dynamic SQL or mutation,
and disable query JIT startup overhead. Only the named public read functions
are executable by the app. Never grant the owner credential to the Worker.

The app-role qualification returned non-empty grid (147628 bytes), regional
registry (42929 bytes) and global registry (36603 bytes) tiles without timing out.
The Worker uses Neon's official one-shot HTTPS driver; it does not hold a TCP
pool. Cloudflare documents this Neon integration directly:
[Neon on Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/).

The project remains Free. Current official limits checked on this date are
1 GB PostgreSQL storage, 100 CU-hours and 5 GB public network transfer per
project per month; this snapshot does not make future traffic unlimited.
[Neon plans](https://neon.com/docs/introduction/plans).

### Local release verification

804 unit tests passed (two existing skips); 12 fast browser checks and all
43 Finder browser checks passed with one browser worker. Typecheck, encoding,
architecture, release guards, backup tamper checks and compiled build passed.
The Finder client route is 489941 bytes against its 500000-byte budget.
No Neon credential binding or PostgreSQL URI occurs in the client assets.
Temporary local database credentials were removed after the encrypted staging
reader secret was provisioned. Production Supabase schema/data/billing and
parked Operations PR #37 were not changed.
