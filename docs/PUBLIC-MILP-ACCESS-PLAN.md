# Public MILP without a sign-in screen

Status: implementation plan after code audit, 23 October 2026. Not deployed.

## Live prerequisite audit — permission expansion requires separate approval

Read-only Actions run 39995247611 completed successfully on 23 October 2026.

- Anonymous sessions: disabled. CAPTCHA enforcement: disabled. Anonymous auth rate limit: 30/hour in current configuration.
- Six relations deny the `anon` role SELECT but grant `authenticated` SELECT with an unrestricted authenticated SELECT policy: `canonical_grid_lines`, `canonical_grid_nodes`, `canonical_industrial_sites`, `grid_operators`, `grid_sources`, `public_capacity_observations`.
- Enabling anonymous sessions unchanged would make those read permissions available to new anonymous identities. This is a permission expansion, not evidence of an existing anonymous data leak or proof that the rows contain customer secrets.
- Thirty security-definer functions are executable by `authenticated` but not `anon`. Their own authorisation logic requires review; the grant alone does not establish a vulnerability.
- Existing analytics-job SELECT remains owner-scoped.
- No live auth settings, schemas, data, grants, functions, billing or deployments were changed by this audit.

Additional proposed scope, not yet approved: review and add anonymous-user restrictions to non-public data access and privileged functions, preserving current named-user access and intentionally public Finder access. Permit only the owner-isolated public MILP path for anonymous identities. Present exact reviewed SQL before application, qualify it against disposable Postgres and repeat the live permission audit before enabling anonymous sessions. Do not blanket-revoke the authenticated role or expose the six relations as a workaround.

The previous approval covers the public-job admission/claim migration and enabling anonymous sessions after a passing audit. Per the approval boundary below, this additional non-job permission hardening is held pending separate approval.

## Audited starting point

- `analytics_jobs.owner_id` is non-null and references `auth.users`.
- Existing SELECT policy checks `owner_id = auth.uid()`; client INSERT/UPDATE/DELETE are revoked.
- The existing Python API validates Supabase sessions, and the existing job runner owns execution and replay publication.
- The disabled free runtime currently requires an email and owner allowlist. Remove that temporary public-launch assumption, not job ownership.
- Existing admission is per process and per owner. It cannot guarantee public quotas or a queue bound across restarts/deploy overlap.
- Existing claims are scoped by job type, not public/private access. Public processing must not consume unrelated private jobs.
- The cross-tab MILP presentation candidate remains unvalidated and disabled. Public access does not make it production-ready.

## Architecture decision

Use Supabase anonymous sessions on explicit Run, not on page load. Visitors enter no email, password or registration details. Reuse the existing owner-isolation model rather than inventing bearer tickets, a second queue or another optimiser.

Anonymous sessions are not the public Supabase API key. They create an anonymous user using the authenticated role. Audit existing policies and APIs before enabling this project-wide feature; private APIs must reject anonymous sessions by default.

Results belong to the current browser session. Clearing browser storage loses access; knowing a job UUID alone never grants access. Do not advertise shareable private links without a separately reviewed sharing mechanism. Do not persist customer payloads in local storage or URLs.

## Phase 1 — Security and storage prerequisite (approval required)

1. Read current auth configuration without printing credentials. Inspect relevant RLS policies and callable functions for anonymous-session privilege escalation.
2. Add explicit anonymous identity classification to server-verified user information. Existing private analytics routes reject anonymous users; the public facility-plan surface is a narrow opt-in.
3. Prepare one narrowly scoped migration using the existing analytics job store:
   - Explicit public/private scope, defaulting existing records to private.
   - Owner-based reads remain intact; no anonymous listing of all jobs.
   - Public admission serialised transactionally before insert, with server-owned fixed limits.
   - Idempotency before quota accounting: polling/retry of the same request does not create new solves.
   - Initial policy: one pending job per visitor, at most two pending public jobs globally, three new solves per visitor/hour, and twenty new public solves globally/hour. All attempts, including failures/cancellations, count toward admission usage. Qualification may lower these limits; raising them requires review.
   - Public claim serialised transactionally: one active lease globally; public/private scopes cannot steal each other's jobs.
   - Reuse the existing claim/lease implementation through a scoped extension, not a second queue. Preserve legacy callers and lease/attempt fencing.
   - Only the service role executes mutation RPCs; browser clients cannot change quota parameters or insert jobs directly.
4. Test the migration on disposable CI Postgres before applying. Inspect production drift and back up affected function metadata. No bulk schema push, historical migration repair or unrelated data changes.
5. Apply only after explicit approval. Enable anonymous auth only after the policy/API audit passes; preserve other providers and authentication settings.

## Phase 2 — Bot and HTTP controls

1. Use a verified anti-bot challenge for anonymous session creation/submission; investigate existing configuration before provisioning another widget.
2. Require server-side challenge verification, expected hostname/action checks, expiration/replay protection and bounded verification timeouts. Never trust a browser-only success flag.
3. Apply edge/IP rate limiting without trusting arbitrary forwarded headers. Auth/session rate limiting and solve quotas are distinct protections.
4. Keep body size, workload/profile/interval/battery limits, solver budget and wall-clock limit. Recheck recovered requests at execution.
5. Return 429 with Retry-After for quota/busy cases; return 503 when disabled/unconfigured. Do not issue another solve automatically after uncertain POST failures.
6. No CORS wildcard, public service-role key, shared browser service identity or private result URLs containing tokens.

## Phase 3 — Backend integration

1. Reuse current API submission, job store, cancellation, polling, isolated child process and actual Fullb MILP.
2. Public routes expose only submit, owner-scoped status/result and cancellation. Do not expose the private job inventory or unrelated analysis endpoints.
3. Distinguish process health, configured readiness and public-execution enablement.
4. Bound queue admission durably; persist accepted jobs in Supabase. A restarted instance can recover leases without resetting quotas.
5. Stop solver work on cancellation/shutdown/lease loss; stale attempts cannot publish. Never delete another visitor's jobs to free capacity.

## Phase 4 — Frontend and shared outputs

1. Obtain/reuse an anonymous session only after explicit user intent and any required challenge. No sign-in UI or email allowlist.
2. Reuse the existing planning workbench and reviewed component mapper. Do not invent per-job permissions, power profiles, deadlines or battery terminal targets.
3. Show queued/running/busy/cancelled/infeasible/failed/rejected-result states distinctly. Preserve a job ID for resumption, not customer payloads in URLs.
4. Accept only matching, replay-valid solver results through the existing canonical acceptance projection.
5. Use one accepted result across Overview, Compute & Workloads and Power & Battery. Input changes invalidate it; inspection/legend changes do not solve again.
6. Keep scenario and MILP labels explicit. No heuristic substitution labelled MILP; no claims of live dispatch or measured delivery.

## Phase 5 — Remote qualification

1. Focused checks first, then one full regression on the final candidate. No local heavy validation.
2. Two anonymous visitors cannot read, cancel or list each other's jobs, including with known UUIDs. Missing/expired/forged sessions are rejected.
3. Test simultaneous admission, global queue and lease limits, idempotency, quota exhaustion and restart recovery against disposable Postgres.
4. Test failed/replayed challenges, untrusted IP headers, oversized payloads and disabled configuration.
5. Qualify the exact packaged private engine/core revisions: battery, generation, flexible-load and replay regression; feasible/infeasible/timeout cases.
6. Verify cross-tab numeric consistency, stale results, keyboard interaction and chart/table selection in remote browser tests.
7. Measure peak memory and total duration on the real free runtime; document cold starts and free-allowance exhaustion. Never infer a global lock from a one-worker setting.

## Phase 6 — Restricted operational rollout, public audience

1. Verify free-plan/account spending constraints before provisioning; do not change billing or create paid infrastructure.
2. Deploy the exact validated artifact disabled first, with secrets forwarded server-to-server.
3. Perform a bounded anonymous end-to-end check before turning on public submissions. No named-user prerequisite.
4. Enable the small quotas above and preserve a kill switch. Validate the live frontend/runtime revisions and actual result provenance.
5. Rollback disables new public submissions while preserving owner-protected records. No database deletion or automatic paid upgrade.

## Approval boundary

No live schema, auth configuration, auth-user creation, billing or deployment changes are made by this plan. The next prerequisite is explicit approval for the narrow public-job admission/claim migration and enabling anonymous sessions after audit. If the existing RLS audit requires additional changes, present those separately before applying them.
