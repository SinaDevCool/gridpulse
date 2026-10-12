# Operations backend stabilization — acceptance and rollout

## Implemented software boundary

The product remains advisory and read-only. No equipment dispatch or scheduler command is authorized by an assessment, review, readiness check, or replanning-policy response. The UI layout is unchanged.

- Ingestion uses bounded bodies and source-specific, expiring, revocable hashed credentials with metric allowlists. One PostgreSQL transaction validates scope, inserts measurements, deduplicates identities, and advances the watermark. Conflicting duplicate contents fail rather than overwrite evidence.
- Workspace reads use bounded per-metric paging, event and receipt cutoffs, accepted forecast versions, meter freshness checks, and deterministic input fingerprints. Missing migrations and persistence failures are not presented as empty evidence.
- Server-side calculation persistence saves recalculated results and input snapshots. Numeric recommendation versions and calculation snapshots are immutable; human reviews append to history and bind to a recommendation fingerprint.
- The existing canonical Python engine remains the facility optimizer. The worker now dispatches all canonical Operations job types, renews leases, rejects late/cancelled completion, limits expired-lease retries, and deduplicates active/successful jobs transactionally.
- Replanning policy enforces evidence freshness and caller-declared churn thresholds, while safety changes bypass routine churn limits. It returns a decision, not automatic dispatch or an automatically queued job.
- Historical validation uses a fixed training origin rather than holdout leakage. Exceedance percentages remain empirical estimates, not calibrated guarantees. CSV timestamps require explicit UTC offsets.

## Validation gates

Run `npm run typecheck`, `npm test`, `npm run test:operations:database`, `npm run build`, and the Operations Playwright regression suite. Run the Python API/durable-worker tests and canonical facility, rolling, replay, and optimizer tests with the approved canonical-engine artifact installed.

The database gate executes the real migrations against isolated PGlite PostgreSQL. This checks SQL, scope enforcement, atomicity, reviews and leases; it does not replace staging Supabase JWT/RLS tests, concurrent-worker load tests, or production migration rehearsal.

## Rollout procedure

1. Back up the target database and rehearse all four new migrations in order on staging. Audit existing owner/facility/source linkages before enabling the stricter triggers. Resolve inconsistencies explicitly; do not silently reassign evidence.
2. Apply ingestion, worker, review and job-idempotency migrations before deploying code that calls their RPCs. Verify authenticated users cannot call connector/service-only RPCs or modify existing review history.
3. Provision a separate high-entropy connector credential for each accepted source; store only its SHA-256 hash and approved metric allowlist in the credential table. Set expiry and rotation ownership. Do not reuse the former shared ingest token.
4. Install the approved canonical engine in the Python service, configure durable Supabase storage and worker dispatch, and supervise workers. Validate readiness configuration, actual database access, worker liveness, cancellation, lease expiry and restart recovery separately.
5. Deploy the API with restricted service credentials and bounded network timeouts. Verify owner-scoped workspace reads and calculation writes with two distinct real staging accounts. Compare stored fingerprints and results across repeated requests.
6. Run historical replay and shadow verification using operator-approved meter/BMS/workload data, with agreed reserve, terminal-SOC, deadline, forecast and review-time acceptance thresholds. Retain evidence and discrepancies; keep physical execution disabled.

## Remaining external acceptance and limitations

Release validation on 10 October 2026 applied the four migrations to the linked Supabase project after a dry run and a read-only preflight found no existing Operations records in the affected tables. Remote migration history matches local history. Post-migration checks confirmed ingestion RPCs are service-role-only and authenticated users cannot update saved dispatch reviews. Connector provisioning and Python service hosting remain separate deployment gates.

No real facility connector credentials, operator dataset or signed acceptance thresholds were supplied. Therefore live-facility integration and real pilot acceptance are not complete. Readiness is a configuration signal, not a claim that a live site is connected.

Workspace assembly spans multiple reads; its fingerprint is reproducible evidence identity, not a database-wide transactional snapshot guarantee. Large windows fail at the explicit measurement page bound rather than truncate. Persisted historical inputs remain caller-supplied evidence unless provenance is independently verified.

Solver work is protected by leases and bounded retries, but a hard process-level solver timeout and external worker supervision still need deployment-specific configuration. Retention must account for immutable snapshots: deleting referenced forecasts or agreements can be blocked by version guards. Use a reviewed archival/retention procedure rather than mutating assessed inputs.

Dependency advisory remediation must be rechecked before deployment. Compatible transitive dependency updates were applied after retrying Windows/OneDrive file locks; do not interpret passing functional tests as a clean full dependency audit. A separate existing Power Finder release-artifact hash mismatch also blocks claiming a completely green repository-wide Python suite.
