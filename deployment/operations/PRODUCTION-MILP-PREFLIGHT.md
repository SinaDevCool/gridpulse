# Production MILP: free-only storage preflight

## Approved boundary

- Production integration, not another staging environment.
- Hosting must remain free. No paid plan or new paid resource is authorized.
- Existing Supabase job storage may be reused. No schema migration is authorized.
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

1. The current `claim_analytics_job(p_worker_id, p_lease_seconds)` contract
   claims globally from the analytics queue. The production MILP service must
   not drain unrelated jobs simply to run Operations facility plans. A scoped
   claim capability needs review and explicit authorization if implemented as
   a database function change. Do not work around it by duplicating the queue
   or running unfenced inline tasks.
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

Only the preflight tooling is changed. No application runtime, production
feature flag, database object, Render plan or production deployment is changed.
