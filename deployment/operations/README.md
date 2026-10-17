# Operations backend release gates

This is a provider-neutral staging preparation, not a completed deployment. No paid infrastructure, production migrations, or facility control actions have been performed.

## Source baseline

Implementation branch: `codex/operations-backend-stability`, based on released commit `6cc477f0e67cc398d444d5c86505cd5210ae5ba4`.
The original synchronized checkout contained divergent local files and was left untouched. Source backup: `C:\Users\sinak\.codex\backups\gridpulse-operations-20261018`. Reconcile those unique edits separately before merging; do not reset or force-push the connected Lovable branch.

## Implemented safeguards

- Separate liveness and dependency-backed readiness; readiness requires the approved engine, database access and a fresh worker heartbeat for the same environment and revision.
- One spawned calculation process per worker, bounded execution time, shutdown fencing and optional Linux address-space limit. Container resource settings are starting bounds, not measured service guarantees.
- Owner-wide admission of 20 active jobs, deduplication before admission, transient-only retries with backoff, and at most three attempts.
- Immutable job input and execution identity, including source revision, installed engine version, artifact checksum and canonical input hash.
- A single security-invoker workspace RPC reads the evidence tables under one database snapshot, preserving user JWT/RLS. Oversized inputs fail explicitly instead of silently truncating calculation evidence.
- Service-only fleet metrics and heartbeat RPCs. These require external monitoring to become operational alerts.

## Prerequisites — currently unavailable

1. Approved hosting provider, region and spending ceiling.
2. Separate staging Supabase project and test accounts; never reuse production credentials.
3. Approved `gridpulse-capacity-backtest` wheel, its exact version, SHA-256 and authorization to deploy it.
4. Authorized historical facility input, agreed benchmark results and an operator reviewer for real-data acceptance.

Do not replace the private engine with synthetic outputs or treat local fixture tests as real-facility validation.

## Staging release sequence

1. Review all forward-only migrations `20261018120000` through `20261018160000`. Take a staging backup first. Apply these before deploying the new writers or workspace reader; the old reader must not be the new code's fallback when an RPC is missing.
2. Place exactly one approved wheel, retaining its valid original filename, in ignored `services/grid-data/vendor/`. Copy `.env.example` to ignored `.env` and enter staging values. The container wheel path must match that filename.
3. Build with `docker compose --env-file deployment/operations/.env -f compose.operations.yml build`. Run `pip check` in the image and verify installed private version/contract. The lock file pins public dependencies; Linux/container compatibility remains a release gate until this build succeeds with the actual wheel.
4. Start the same immutable image for API and worker with the compose recipe. Publish only through the approved HTTPS gateway; the example API port binds loopback. Check `/health/live`, then `/health/ready`. A live HTTP process alone is not a usable calculation service.
5. Run `services/grid-data/scripts/check_operations_runtime.py --base-url <staging-HTTPS-URL> --revision <commit>`. Do not route frontend traffic until it passes.
6. Provision two disposable users and owned fixture records through the existing application. Set the explicitly named staging environment variables documented in `check_staging_isolation.py`, then run it. It checks real JWT read isolation and denial of service-only RPCs; it does not certify write isolation or revocation.
7. Separately test writes, revoked JWTs, simultaneous duplicate submissions, concurrent owner quotas and worker claims using independent database connections. Local PGlite tests are useful regression tests, not proof of multi-connection isolation.
8. On staging Linux, terminate a busy worker, force a timeout, expire a lease, cancel during execution, interrupt publication and restart. Confirm old attempts cannot publish, retry count is bounded, and resources are reclaimed. Legacy multi-table publishers are not claimed to be transactional exactly-once writes.
9. Query `operations_runtime_metrics(environment, revision)` as the service role. Configure alerts for queue age, expired leases, failures and missing workers using thresholds agreed after load tests. Never expose this RPC or service credential to the browser.

## Real facility replay and shadow acceptance

Use authorized, timestamped facility/IT energy, import demand, battery limits and SOC, reserve policy, workload windows and deadlines. Preserve units, time offsets, received times and source quality. Reject gaps or explicitly label assumed values. Current snapshot configuration is not a reconstruction of historical configuration changes.

Replay the same versioned input package against the approved engine. Check interval power balance, SOC bounds and energy evolution, inverter/power limits, reserve preservation, deadline feasibility and deterministic repetition. Include zero battery, empty workloads, infeasible demand, missing/stale evidence and interval-boundary cases. Compare against an independent accepted baseline, not merely the same implementation twice.

Agree tolerances and review time targets with the operator before assessing results. Record input hash, source/engine identity, outputs, discrepancies and human acceptance. Start read-only shadow planning only after these pass. Automatic physical dispatch remains disabled; approval of a brief is not authorization to actuate equipment.

## Backup, rollback and release approval

- Restore a staging database backup into a separate disposable project and verify facilities, evidence, jobs and version-bound reviews. A backup file alone is not a tested restore.
- Retain the last working immutable API/worker image and frontend release. Pause new submissions, drain or fence in-flight attempts, then roll back application images if required. Do not erase evidence or reverse SQL destructively; use reviewed forward repairs.
- Re-run readiness, tenant isolation, a known assessment and review-version checks after rollback.
- Record real staging, Linux failure-drill, concurrency, replay, restore and operator sign-offs before promoting. None of these external acceptance gates is certified by this local implementation.
