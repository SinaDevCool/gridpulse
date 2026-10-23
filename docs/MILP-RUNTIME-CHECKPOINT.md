# Production MILP continuation checkpoint

Updated 23 October 2026. This is an implementation checkpoint, not a release approval.

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
