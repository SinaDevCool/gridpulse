# Pull request qualification

Automatic frontend validation has one entry point: `frontend-ci.yml`.

1. The reusable MILP workflow runs focused input/result tests, static checks and a compiled, mandatory MILP browser test.
2. Only after it passes, the existing exact-candidate regression workflow runs its unit, database, Python, build, browser and isolation checks.
3. New pushes cancel superseded runs. Batch related edits before pushing; use a draft PR for work in progress. Draft PRs still receive the complete qualification path.

The MILP workflow also supports manual dispatch for branches without a PR. It has no automatic push trigger or branch-name allowlist. Do not manually dispatch it while equivalent PR qualification is already running.

The MILP fixture build and the candidate regression build have different feature flags and purposes. They are not interchangeable artifacts. Existing exact-candidate build sealing and production publishing checks remain unchanged.

Run names and the MILP summary identify the PR head and tested candidate. Old failure emails describe old commits; later passing runs do not retract those emails. Consult the latest PR checks for current status. Genuine failures remain failures, with reports/traces retained; no test is ignored to reduce notifications.

This workflow change does not change account notification preferences, merge a PR or deploy a service. GitHub Actions email preferences are user-controlled at https://github.com/settings/notifications.
