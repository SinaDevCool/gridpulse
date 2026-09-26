# Finder MVP product mode

## Decision

Production launches as an account-free Power Finder MVP. CONNECT and OPERATE remain in the
repository and database but are unavailable in the Finder deployment.

Set the deployment variable:

```text
GRIDPULSE_PRODUCT_MODE=finder
```

Supported modes:

| Mode | Finder | Authentication | CONNECT workspace | OPERATE prototypes |
| --- | --- | --- | --- | --- |
| `finder` | Public | Disabled | Disabled | Disabled |
| `connect` | Available | Enabled | Enabled | Disabled by capability flag |
| `full` | Available | Enabled | Enabled | Enabled |

Unknown values fail closed to `finder`.

## Finder production surface

Only these application routes are enabled:

- `/`
- `/power-finder`
- `/data-sources`

All other TanStack routes remain compiled and tested but return the root not-found response in
Finder mode. The Finder uses the accepted, versioned Brandenburg artifact and an explicit public
field allowlist. It does not initialize Supabase authentication or call private RPCs.

## Dormant capabilities retained

Do not delete these areas while Finder mode is active:

- `src/features/grid-connection/` — CONNECT and OPERATE domain logic
- `src/routes/assessments.*.tsx` — project workspaces
- `src/routes/portfolio.tsx`, `evidence*.tsx`, `reports.tsx` — private workspace views
- `src/routes/operator-review.$id.tsx`, `submission-package.$id.tsx` — operator workflow
- `src/context/` and `src/integrations/supabase/auth-*.ts` — authentication
- `services/grid-data/src/grid_data/flexibility_optimizer.py` — operating-envelope prototype
- `supabase/migrations/` — existing schema, RLS and stored procedures

Existing Supabase users, projects, evidence, storage objects and migrations must be preserved.
Finder mode changes availability; it does not remove customer data.

## Reactivating CONNECT

1. Set `GRIDPULSE_PRODUCT_MODE=connect` in a preview deployment.
2. Enable the intended Supabase sign-in methods. Do not automatically enable unrestricted public
   sign-up; invitation-only access is preferred for the first CONNECT pilots.
3. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`.
4. Re-run RLS and storage-policy tests against a staging Supabase project.
5. Verify `/auth`, `/portfolio`, `/assessments/new`, assessment detail, evidence and reports.
6. Confirm that anonymous users still cannot read project, shortlist, evidence or analytics data.
7. Deploy only after the CONNECT-specific browser suite passes.

## Reactivating OPERATE

1. Complete the CONNECT reactivation checks.
2. Set `GRIDPULSE_PRODUCT_MODE=full` in preview.
3. Treat current flexibility output as planning analysis, not control instructions.
4. Before any live-operation claim, add independently reviewed optimization, telemetry ingestion,
   stale-data handling, fail-safe behavior, authorization, EMS/BMS integration and compliance logs.
5. Keep `automaticDispatchAuthorized: false` until those controls are independently validated.

## Release invariants

- Unknown capacity is never displayed as zero or inferred headroom.
- Only accepted public releases are usable without an account.
- Finder mode makes no auth/session request.
- Dormant routes are blocked at the root route boundary, not merely hidden from navigation.
- The full TypeScript and Python test suites continue to cover retained code.
- Product mode is deployment configuration, never a user-controlled query parameter or cookie.
