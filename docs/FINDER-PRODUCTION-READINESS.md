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

Local verification passed 44 deployment/tooling tests, focused API unit tests,
encoding, TypeScript and architecture checks. Lint has no errors and one existing
Operations fast-refresh warning. Final release and live checks are recorded below
when their exact application commit has qualified.

Production traffic has not been switched by this preparation. A successful
staging run must qualify the exact final application commit before production.

## Remaining boundaries

- Optional property/environment evidence needs source-by-source admission.
- Historical-output calculations need matched real inputs and qualified capacity
  histories before a public headline or cohort comparison can be enabled.
- Operator outcomes and written permissions require the relevant external parties.
- Private workspaces/authentication are not migrated, and Supabase is not retired.
- The local backup is retained; an off-workstation backup destination still needs
  to be established within the user's storage/access choices.
