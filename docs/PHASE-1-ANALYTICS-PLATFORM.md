# Phase 1 analytics platform

## Reuse decision

The API does not implement another operator connector or publisher. The
`OperatorHealthExecutor` calls the existing `fetch_operator_sources` and
`publish_operator_health` functions used by the CLI and scheduled source workflow. CLI, CI, and API
therefore share one evidence boundary.

## Runtime boundary

- Cloudflare serves the TanStack application.
- FastAPI provides authenticated orchestration and job-status endpoints.
- Supabase Auth validates user tokens.
- Supabase `analytics_jobs` is durable job metadata and tenant isolation.
- Existing source and release tables remain the ingestion system of record.
- The in-memory job store exists only for local development and deterministic tests.

The first executor uses FastAPI background tasks. This is intentionally an adapter boundary, not a
claim of durable queue execution. Before multiple replicas or expensive simulation jobs are
enabled, replace the executor dispatch with a managed queue while preserving the API and job table.

## Local run

```powershell
python -m pip install -e ".\services\grid-data[production,api,dev]"
$env:PYTHONPATH = (Resolve-Path "services/grid-data/src").Path
$env:SUPABASE_URL = "https://PROJECT.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "<publishable key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<server-side secret>"
$env:GRIDPULSE_ALLOWED_ORIGINS = "http://localhost:3002"
uvicorn grid_data.api.app:app --reload --port 8080
```

`GET /health` is credential-safe. Job creation and job reads require a valid Supabase access token.
Production API documentation is disabled unless `GRIDPULSE_API_DOCS=enabled`.

## Container

```powershell
docker build -t gridpulse-analytics .\services\grid-data
docker run --rm -p 8080:8080 `
  -e SUPABASE_URL `
  -e SUPABASE_PUBLISHABLE_KEY `
  -e SUPABASE_SERVICE_ROLE_KEY `
  gridpulse-analytics
```

Deploy the container to Cloud Run or an equivalent managed container platform. Store all three
server environment values in the platform secret manager. Configure
`VITE_ANALYTICS_API_URL` only after the HTTPS service URL and CORS policy are approved.

## Staging gate

A real staging deployment requires a separate Supabase project and a non-production container
service. Do not deploy the analytics API against production merely to call it staging. Before
promotion:

1. Apply `20260724050000_analytics_job_foundation.sql` to staging.
2. Verify authenticated user A cannot read user B's job.
3. Run an operator source health job.
4. Confirm source checks persisted and the job reached `succeeded`.
5. Restart the API and confirm the job record remains readable.
6. Confirm API logs contain request/job IDs and no tokens or secret values.
7. Point a staging frontend build at the staging API.

## Phase 1 acceptance

- Existing connectors and publisher are reused.
- Health and authenticated job endpoints have contract tests.
- Job ownership is enforced in API and PostgreSQL RLS.
- Service-role credentials remain server-only.
- Container runs as a non-root user.
- Python lint and tests run in GitHub Actions.
- Production remains on the CLI workflow until the staging container gate passes.
