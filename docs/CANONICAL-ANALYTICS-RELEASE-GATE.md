# Canonical analytics release gate

The production application may publish canonical analytical workflows only when `npm run verify:canonical` passes from `GridPulse-Full`.

The requirement-to-evidence index is `docs/PHASE-0-12-CANONICAL-IMPLEMENTATION.md`.

The normal gate runs production type checking, transport-contract tests, tenant-isolated API tests, architecture-boundary tests, and the backtest repository's complete non-slow suite, Ruff, and mypy. Long-running statistical and integration tests are deliberately excluded from ordinary development. Release qualification explicitly adds the complete production unit suite, encoding and public-security checks, client/SSR build, Power Finder browser workflow, and every isolated slow analytical shard:

```powershell
$env:GRIDPULSE_RUN_SLOW = "1"
npm run verify:canonical
```

The deployed security probe is intentionally separate because it requires the candidate release
and its Supabase policies to be online:

```powershell
$env:GRIDPULSE_RUN_SLOW = "1"
$env:GRIDPULSE_RUN_EXTERNAL = "1"
npm run verify:canonical
```

Release invariants:

- `gridpulse-grid-core` owns reusable electrical calculations.
- `gridpulse-capacity-backtest` owns capacity, flexibility, uncertainty, rolling planning, market qualification/settlement, replay/economics, evidence-package, and shadow-verification calculations.
- The production service owns authentication, tenancy, durable jobs, cancellation, and transport.
- React owns validation and presentation only; it may not recreate analytical outcomes.
- Identical owner, job type, and canonical input fingerprint resolve to one durable job.
- Public, synthetic, and customer-assumption results remain nonclaims.
- Every operational result states that automatic live dispatch is unauthorized.
- Shadow adapters are read-only; command transports are outside this repository's authorization.
- Operator confirmation, security review, license inventory, backup/restore evidence, incident-response evidence, secrets rotation, and the slow suite are required before operational release.

Rollback is performed by disabling the affected production route/job type and reverting to the previous immutable application and engine artifacts. Published Git history must not be rewritten because the repository is connected to Lovable.
