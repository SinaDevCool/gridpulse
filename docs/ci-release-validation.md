# CI failure repair — 10 October 2026

The repeated notification emails were GitHub Actions failures on PR #36, not facility dispatch failures. Run 37997325863 failed Ruff import ordering; run 38002511640 failed the Ruff formatter gate in four files. Apply the exact workflow lint and formatting paths before pushing. Ruff is pinned to 0.16.0 to keep local and CI checks consistent.

Running subsequent gates exposed a stale Release 2 reference to the committed Release 1 result digest. That reference and its self-hash were updated without changing capacity values or weakening the governance tests. The C1 reference benchmark and public-release audit were regenerated with the current implementation.

The deployment job now installs Python dependencies and calls Python directly instead of Windows-only PowerShell npm scripts on Ubuntu. Test and evidence gates remain enabled. Email notifications were not disabled.

Release bundle limits remain unchanged. Landing-only CSS is loaded with PublicLayout; the Finder map, legend and candidate-detail components load through React Suspense. Validate map rendering and candidate actions as well as Operations before publishing.

This web deployment does not provision a separately hosted Python analytics worker or live facility connectors.
