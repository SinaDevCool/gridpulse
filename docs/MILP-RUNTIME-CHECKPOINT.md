# Production MILP continuation checkpoint

Updated 23 October 2026. This is an implementation checkpoint, not a release approval.

## Latest continuation: activation blocked by missing approved account

- Branch head eec66c2 passed 41 focused runtime tests, formatting and source lint in run 39993164856.
- Its separate read-only activation check returned approved account matched=0, confirmed=0 for the approved email; pending facility jobs=0. The overall workflow is intentionally failed by that gate.
- Added shared pre-execution validation for recovered jobs and a foreign-backlog pause before claiming. No additional SQL migrations.
- Frontend cross-tab presentation and workbench connection are saved as an UNVALIDATED implementation candidate. They are feature-disabled by default, not production-ready, not deployed, and still require focused tests, type/lint/architecture checks and review.
- Before continuing activation, the user must create and confirm the approved Supabase sign-in account or specify a different existing account. Do not create auth users, reset passwords or grant another account silently.
- No production Render runtime has been created or activated in this continuation. Existing services remain unchanged.

## Verified

- Scoped claim migration and live storage inspection passed in Actions run 39985304692, attempt 2.
- Existing Render and Supabase credentials were verified without exposing values.
- Runtime reuses the existing API, Supabase job store, lease worker, isolated Python engine adapter and result contract. No second queue or optimiser.
- Runtime remains disabled by default. API access requires verified Supabase identity and an explicit account allowlist.
- Focused remote checks at a7926c5: 38 passed; source lint passed. Formatting corrected afterward; verify the new candidate before release.
- No local solver, test suite, build or browser automation was run during this continuation.

## Remaining release gates

1. Revalidate the final candidate, including full existing Python regression remotely.
2. Enforce size/time and allowed-owner policy again at execution, including recovered records. API admission alone does not qualify existing pending records.
3. Inspect existing pending facility jobs before activating a scoped worker. Type scoping is not owner scoping; do not drain unrelated jobs.
4. Qualify restart recovery, resource peak and cold-start behaviour on the actual free runtime. One process is not a global cross-instance concurrency guarantee.
5. Package the existing private Fullb engine with a pinned core revision; do not copy or rewrite it.
6. Configure free Render production hosting disabled first, forwarding secrets server-to-server only. Verify account spending controls and shared free-hour limits.
7. Connect the accepted authenticated job result to the shared Operations presentation, with stale-input rejection and honest MILP/fallback labels across all three tabs.
8. Verify the approved account exists, then perform authenticated end-to-end validation before activation. Do not create passwords or claim successful login without evidence.

Production charts have NOT been switched to MILP by this checkpoint. PR #37 remains excluded. Existing synthetic Render pilot remains unchanged.
