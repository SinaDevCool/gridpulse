<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Resource-safe local validation

- This workstation has 16 GB RAM. Do not overlap unit tests, browser suites, builds, typecheck or lint. Parallelize only lightweight read-only inspection.
- Use `npm run verify:local -- operations` for focused Operations validation; use `npm run verify:local -- unit <test-file-or-directory>` for narrower tests.
- Use `npm run verify:local -- checks` for sequential tooling tests, encoding, typecheck, architecture and lint without a full unit/browser/build pass.
- Default Vitest to 2 workers and Playwright to 1. Do not raise worker counts or Node heap limits without evidence and user approval.
- Run relevant tests while editing. After edits settle, run the full suite once if the risk warrants it; do not repeatedly run all suites after every small edit.
- Use `npm run verify:local:full` for a sequential final local pass. Finder regression is opt-in: `npm run verify:local -- finder`. CI retains broad cross-product coverage.
- Browser specs run in separate managed stages so disposable test servers/browsers close between specs. Use `npm run verify:local -- build` or `-- runtime` for bounded production-build or compiled-Worker checks without repeating the entire suite.
- The managed runner serializes its own invocations across worktrees and checks available RAM before each stage. Direct npm/npx commands bypass that lock: never run them alongside a managed validation run.
- The managed runner checks memory during each stage too. Two consecutive samples below 1536 MB (or failed memory readings) cancel only its own stage tree and prevent later stages; do not bypass that safety stop.
- Stop a development server started for this task before a production build; preserve user-owned servers. Do not kill unrelated processes, restart apps, disable security software or change system/pagefile settings to reclaim RAM.
- Use `npm run verify:memory` to record a bounded two-worker Compute unit run; `-- -Target <path>` changes the target, with `src` explicitly selecting all unit tests. Reports are local under `.codex-tmp/memory/`. Report measured peak values rather than claiming a memory leak or guaranteed prevention of stalls.

## Parked Operations backend — PR #37

- PR #37 (`codex/operations-backend-stability`) remains excluded from generic commit/push/deploy requests. Resume only with explicit authorization naming it.
- Start development branches from current production `origin/main`. Preserve released PR #38 calculation corrections.
- Do not release PR #37-only migrations, workspace-reader changes or Python worker/runtime additions. Do not change Supabase schema, data or billing without explicit authorization.
