# Public Finder production readiness

User authorised autonomous technical preparation and verification on 21 November 2026. Scope remains the public Finder. PR #37 stays parked, and Supabase schema,
data and billing are unchanged.

## Recovery drill completed

Created the separate Frankfurt Free project `gridpulse-production`
(`still-dust-71436907`), production branch `br-raspy-wave-bgltqn69`, PG17,
fixed 0.25 CU. Restored the retained verified backup into a clean database.
This was a fresh load, not a copy-on-write clone of staging.

All 654267 records match the admission counts and source geometry/property
hashes; zero invalid/empty geometries and zero hash mismatches. The separately
restored 23445 operational-status exceptions match their source checksum.
Activation measured 535986176 bytes, below the existing 700 MiB admission gate.
The app role returns 2440 operators, accepted national coverage and populated
grid/registry tiles. It cannot write raw features or activate snapshots.

The drill exposed a loader timeout shared across the entire operation. Requests
now receive independent deadlines. A matching manifest can resume an inactive
restore; completed batch counts are checked, and activated or differently
identified snapshots cannot be overwritten. All files are verified before writes.

## Environment and release boundaries

Registered staging and production targets are separate in
`deployment/neon-finder/targets.json`. Credentials must match the declared target,
database, dedicated role and TLS requirements. A production URI cannot qualify
as staging, or vice versa. Owner credentials cannot qualify as app credentials.

The public admission identity lives in `release.json`. Server queries check both
snapshot ID and manifest SHA. Cache keys include environment and data identity.
Browser requests carry the public release token in tiles, viewport, catalogue,
coverage and study reads. A mismatched token returns 409 before querying data,
and viewport loading does not substitute a static fallback for that condition.

Immutable public catalogue/coverage responses use a one-hour edge cache scoped
to that identity. Failed responses are not cached; cache errors do not fail a
successful origin result. Viewport and tile bounds/rate limits remain in place.
This reduces repetitive reads; it does not promise unlimited free traffic.

## Deployment preparation

Production reader credential qualified against the restored manifest and
privileges, then stored as an encrypted GitHub production environment secret.
Temporary local owner/reader credentials were removed.

Production builds select the explicit production Worker environment. Deployment
validates the packaged target, runs the live release guard, qualifies/binds the
reader, verifies the sealed artifact again and publishes without rebuilding.
Both release workflows validate reference syntax before expensive checks.
The production environment's required reviewer protection remains unchanged.
Before binding secrets, the release records the previous fully deployed Worker
version. A failed production check after publishing restores that recorded version;
the metadata is retained as a 30-day workflow artifact. This restores application
code and bindings, not external database contents. The existing Supabase source
and the admitted Neon snapshot remain intact.

Verification passed 44 deployment/tooling tests, 809 unit tests (two existing
skips), encoding, TypeScript, architecture, asset budgets and compiled Worker
checks. Local browser validation passed all 12 fast and 43 Finder scenarios.
Broad CI browser and isolation checks passed too. Lint has no errors and one
existing Operations fast-refresh warning.

## Production release completed

PR #98 merged as `5c5b343a3d65a3d3a9468b75bf2342316000196c`.
[Staging run 44918492997](https://github.com/SinaDevCool/gridpulse/actions/runs/44918492997)
qualified that exact commit and the live public projection.
[Production run 44919589899](https://github.com/SinaDevCool/gridpulse/actions/runs/44919589899)
completed successfully, publishing Worker version
`0f2facb6-7f72-42fa-a373-6b97f2e6dd67` to
[GridPulse](https://gridpulseinsights.com/power-finder).

The authenticated named reviewer's normal deployment approval was used under
the user's explicit delegated instruction. No environment protections or freeze
rules were removed. The production reader qualified immediately before binding;
the packaged artifact was verified again before publishing without rebuilding.

Live production health and map checks passed. Further real browser checks
verified 2440 operators, grid and registry tiles, Berlin/Bremen/Munich candidate
searches with cap disclosure, enquiry drafts and evidence receipts. Both tile
layers loaded (nine successful tiles each), with zero failed Finder API requests.
An outdated release request returned 409. Optional property enrichment remained
explicitly unavailable with zero invented findings.

The release also completed a real public facility MILP and checked the same
accepted result across all three Operations tabs. The existing Meta-backed
copilot passed three grounded conversational turns and its evidence-linked
brief. These checks do not qualify grid-node import capacity or physical dispatch.

The previous Worker identity is retained in the production rollback workflow
artifact. Local completion records and live screenshots are retained under
`C:/Users/sinak/.codex/backups/gridpulse/release-20261121/`.

## Remaining boundaries

- Optional property/environment evidence needs source-by-source admission.
- Historical-output calculations need matched real inputs and qualified capacity
  histories before a public headline or cohort comparison can be enabled.
- Operator outcomes and written permissions require the relevant external parties.
- Private workspaces/authentication are not migrated, and Supabase is not retired.
- Local recovery files are retained. An owner-only
  [Drive backup](https://drive.google.com/drive/folders/16xdMQx6ft4ZrZ0HmmlnNPmOPUHyimSiH)
  holds two archive parts and recovery metadata; both parts passed downloaded
  SHA-256 readback checks. No credentials or private workspace records are included.

The ordered implementation steps and external acceptance criteria are in
[FINDER-REMAINING-ROADMAP.md](FINDER-REMAINING-ROADMAP.md).
