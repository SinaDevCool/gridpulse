# GridPulse production operations

## Deployment gate

`Deploy GridPulse` runs on every push to `main`. It must pass encoding, TypeScript, unit, build,
browser-journey, Wrangler dry-run, deployment, and post-deployment health checks. A green workflow
means that the deployed version responded successfully; it does not establish grid capacity or
operator approval.

The separate `Grid source health` workflow monitors MaStR and operator-source availability. The
`Production application health` workflow checks the web application, accepted screening release,
and Supabase Auth every hour. These workflows have different responsibilities and must not be
combined.

## Production verification

Run the credential-safe application check with:

```powershell
$env:GRIDPULSE_HEALTH_BASE_URL = "https://gridpulseinsights.com"
$env:VITE_SUPABASE_URL = "<project URL>"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "<publishable key>"
node scripts/check-production-health.mjs
```

Confirm database migration reconciliation with:

```powershell
npx supabase migration list
```

Local and remote migration identifiers must match before relying on a newly deployed feature.

## Application rollback

Cloudflare application rollback and grid-data rollback are separate operations.

1. Record the failing deployment run, commit SHA, Cloudflare version ID, and observed symptom.
2. Select the most recent known-good Cloudflare Worker version.
3. Roll back traffic to that version using Cloudflare deployment controls.
4. Run `node scripts/check-production-health.mjs`.
5. Create a forward-fix commit on a feature branch; do not rewrite published Git history.
6. Preserve failed deployment logs for the incident record.

An application rollback does not reverse Supabase migrations. Database migrations must be
forward-compatible with the previous application version. A destructive database reversal requires
a reviewed migration and backup, never an ad-hoc production command.

Grid-data releases use the atomic release rollback described in `docs/GRID-DATA-OPERATIONS.md`.
Never delete ingestion history or raw source evidence during rollback.

## Environment boundary

- Local development may use deterministic fixtures.
- CI validates pull requests and production deployment candidates.
- Staging must use a separate Supabase project and non-production Cloudflare environment.
- Production uses the approved GridPulse project and `gridpulseinsights.com`.

Do not point a staging build at the production Supabase project. Provisioning a separate staging
Supabase project remains an external account-administration action; until it exists, database or
operator-data experiments must remain local and must not be described as staging validation.

## Incident priorities

1. Protect customer and operator data.
2. Stop incorrect conclusions from being displayed.
3. Preserve the last accepted grid-data release.
4. Restore the last known-good application.
5. Diagnose and ship a forward fix.
6. Record root cause, impact, detection, and preventive action.
