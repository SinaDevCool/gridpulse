# Public MILP launch plan — CAPTCHA-free mock

Decision: 23 October 2026. Public submissions will not require Turnstile or CAPTCHA.
This changes the candidate integration only; it does not activate production.

## Minimal release evidence — 23 October 2026

- CAPTCHA removal qualified; restricted anonymous signup and owner-scoped reads verified live.
- Real free Render runtime: `gridpulse-operations-milp`, `srv-dbdqs1jrjlhs73833tng`.
- Fullb release candidate `c319ff46342619c84e9a5c1ee0575479912bfcdc`, core runtime pinned to `2627576cb365a8b2b0820e9a75a4e96cb6b67d3f`.
- The 96-interval browser mock failed the 0.1-CPU solver budget without OOM. The minimal public mock therefore uses 24 hourly intervals over the full day; five workloads and battery constraints remain.
- The safety reserve is an import target, not a demand-response promise. A defined morning event permits recovery outside it.
- Corrected hourly request passed actual-engine qualification and the 512-MiB/0.1-CPU resource gate (Fullb run 40007851908).
- Live hosted request completed with `optimal` status, physical replay passed, and the real result passed the shared frontend projection (core run 40008917801).
- Existing synthetic-only service remains untouched. No new schema or billing changes were applied in this continuation.
- Frontend production rollout and three-tab browser smoke remain the final release gate; a healthy Render endpoint alone does not prove the app has switched.
- Public mock is best-effort, quota-limited and not a production SLA or customer-calibrated control system. Existing imported customer evidence is not silently converted to this synthetic model.

## Boundaries

- Reuse the existing Fullb SciPy/HiGHS optimiser, core API/store and shared result projection. No second solver or queue.
- Keep restricted visitor identities, owner-isolated results, private/public claim isolation and service-role-only admission.
- Preserve one active public solve, two pending public jobs globally, one pending job per visitor, three new jobs per visitor/hour and twenty globally/hour. Anonymous identities can be recreated; these are capacity limits, not reliable bot prevention.
- Preserve the 1 MB request bound, 96 intervals, five jobs, one battery, reviewed-profile bounds, 30-second solver budget and 90-second execution deadline.
- Keep physical dispatch disabled. No paid services, PR #37 work, unrelated migrations or production data deletion.
- CAPTCHA-free public access is best-effort: automated visitors can exhaust the global quota or free hosting allowance.

## Phase 1 — qualify this removal

Remove the browser challenge parameter and server submission-guard prerequisite. Preserve existing-session checks and reject broad authenticated anonymous tokens. Update session/API regression tests, including disabled-runtime and identity-denial cases. Run focused frontend/backend qualification remotely. Do not run heavy validation on the workstation.

Acceptance: no CAPTCHA prerequisite in the active candidate path; auth, input limits, admission and cancellation isolation remain enforced. Flags remain off.

## Phase 2 — finish the existing runtime package

Inspect the Fullb packaging and pin its core dependency to the exact qualified integration revision. Reuse its Docker deployment rather than copying solver code into the app. Run actual-engine integration tests remotely with battery, generation, flexible loads, protected workloads, infeasible inputs and solver timeout/status handling. Replay feasibility before accepting results. Verify the release excludes parked PR #37-only changes.

Acceptance: immutable engine/core revisions, real MILP result and replay evidence; no heuristic result labelled MILP.

## Phase 3 — configure secure anonymous access, without CAPTCHA

Verify the already-applied public-job migration and custom-token hook, including named users and nullable legacy identity fields, before enabling the hook. If a correction is necessary, use a separate reviewed migration; never rewrite applied SQL. Configure restricted visitor claims before enabling anonymous signup. Leave CAPTCHA off. Verify visitors cannot read other owners' results or gain private API privileges. Establish a bounded retained-job/storage policy or admission backpressure before unlimited-duration public use; do not silently delete records.

Acceptance: anonymous signup issues only the restricted role, named-user behavior is unchanged, owner-isolation checks pass, and storage growth has an explicit bound.

## Phase 4 — deploy the real service on free Render

Verify the current workspace allowance and spending controls. Do not upgrade or create paid infrastructure. Preserve the existing synthetic demo unless its replacement is explicitly agreed. Deploy the qualified package with existing Supabase credentials transferred server-to-server, fixed CORS origins, one worker and bounded numerical-library threads. Do not expose service-role keys in browser code or logs. Initially keep submissions disabled. Verify health, cold start, restart recovery, cancellation and lease exclusivity before activation.

Acceptance: a reachable real-engine API with verified runtime revisions and no synthetic-only endpoint substituted for a solve. Free-service sleep and quotas are disclosed; no uptime guarantee or artificial keepalive.

## Phase 5 — connect the normal Operations action

Use the existing canonical input mapper, reviewed component model and common assessment projection. Resolve any missing reviewed model/calibration inputs explicitly; do not invent them or double-count PUE overhead (PUE remains reference in component mode). Wire explicit Run/Recalculate intent to `ensureVisitorSession`, then the existing facility-plan POST/poll/cancel path. Do not create identities on page load, and do not create a new identity for result reads or cancellation. Preserve the separate SDK storage namespace.

Show queued/running/succeeded/infeasible/timeout/failed states and genuine solver provenance. Update Overview, Compute & Workloads and Power & Battery from one accepted result and input identity. Input changes mark the result stale. In MILP mode, errors must not silently replace results with the heuristic. Keep the heuristic explicitly named as a separate scenario option if retained.

Acceptance: the normal calculation action, not a JSON-only advanced panel, completes an actual MILP solve and all three tabs consume the same accepted result.

## Phase 6 — release and prove the user journey

Complete focused, integration and cross-product CI for the final candidate. Build the frontend artifact once for its exact release SHA; deploy that validated artifact using the existing publishing workflow. Enable flags only after runtime/access checks pass. In production, submit one bounded scenario, verify solver identity/status and cross-tab consistency, then change an input and verify the result becomes stale and recalculates. Check legends/table inspection, owner isolation, quota errors and cold-start messaging. Record the deployed app SHA, engine SHA and test evidence.

Rollback: disable public submission/runtime/frontend flags and return explicitly to the named scenario mode; never pretend heuristic output is a solver result. Preserve durable jobs and the existing synthetic demo. Do not declare MILP live until this production journey succeeds.
