# Production MILP: free-only storage preflight

## Approved boundary

- Production integration, not another staging environment.
- Hosting must remain free. No paid plan or new paid resource is authorized.
- Existing Supabase job storage may be reused. The user subsequently authorized
  the narrowly scoped claim-function change described below. Other schema
  migrations remain out of scope.
- PR #37 remains parked and excluded.

## Read-only evidence

The preflight workflow reads PostgREST metadata with the existing repository
service credential, then performs an explicit `limit=0` table query. It never
calls an RPC, writes a row, reads customer job rows or prints credentials.
Required columns and RPC argument names are derived from `SupabaseJobStore`
and `_job_row` rather than duplicated in a second schema.

Run 39981005239 on commit d87d26f passed nine safeguard tests and found all
17 required columns and six RPC metadata contracts compatible. This is NOT
proof of RLS policies, SQL function implementation, constraints, worker health,
restart recovery or end-to-end production readiness.

## Remaining deployment gates

1. The legacy `claim_analytics_job(p_worker_id, p_lease_seconds)` contract
   claims globally from the analytics queue. Migration
   `20261023180000_scoped_analytics_job_claim.sql` adds a three-argument
   overload with an explicit job-type array. The legacy signature delegates
   to the same implementation with an unscoped filter. Selection AND expired
   retry cleanup are scoped. Empty/malformed scopes are rejected, both
   signatures remain service-role-only, and the existing locks, leases,
   attempt counters and cancellation checks are preserved. No tables are
   added. Operations workers use `--job-type facility_plan`; missing scoped
   RPCs fail closed, never fall back to the global queue. The scoped API does
   not provide per-facility or per-owner filtering; authentication and
   owner-scoped submission/result access remain the existing API's job.
2. A free Render web service is on-demand, not an always-on worker. Official
   constraints include idle spin-down, arbitrary restarts, shared free hours,
   512 MB RAM and 0.1 CPU. Use one bounded solve at a time, durable state in
   Supabase and recovery after wake-up. No artificial keepalive traffic.
3. The synthetic Render service does not establish production authentication
   or production storage credentials. Supply runtime secrets through a secure
   provider configuration path, never through source files or chat.
4. A free compute plan does not guarantee zero total account charges:
   bandwidth/build overages can be billed if a payment method is present.
   Verify account usage/spending controls before activating a free-only release.
5. Before activation, remotely validate tenant isolation, cancellation,
   concurrent claims, recovery, problem-size limits, engine replay and all
   three tabs. No production MILP submission has been enabled by this preflight.

Current platform source: https://render.com/docs/free

## Release status

The preflight tooling, existing store/worker's optional job-type scope, SQL
migration and remote tests are changed. Production application activation and
Render plan changes remain out of scope for this narrow approval. Applying the
migration requires a secure database-management credential; the existing
PostgREST service credential is not a database DDL credential. Do not apply
the entire historical migration chain or repair unrelated migration history.

Qualification uses an ephemeral PostgreSQL 17 database in GitHub Actions to
exercise actual SKIP LOCKED concurrency and role grants; it does not run
PostgreSQL or browsers on the user's workstation. The test runner refuses
non-localhost databases and any database name other than its CI fixture.
