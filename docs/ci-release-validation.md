# CI failure repair — 10 October 2026

The repeated notification emails were GitHub Actions failures on PR #36, not facility dispatch failures. Run 37997325863 failed Ruff import ordering; run 38002511640 failed the Ruff formatter gate in four files. Apply the exact workflow lint and formatting paths before pushing. Ruff is pinned to 0.16.0 to keep local and CI checks consistent.

Running subsequent gates exposed a stale Release 2 reference to the committed Release 1 result digest. That reference and its self-hash were updated without changing capacity values or weakening the governance tests. The C1 reference benchmark and public-release audit were regenerated with the current implementation.

The deployment job now installs Python dependencies and calls Python directly instead of Windows-only PowerShell npm scripts on Ubuntu. Test and evidence gates remain enabled. Email notifications were not disabled.

Release bundle limits remain unchanged. Landing-only CSS is loaded with PublicLayout; the Finder map, legend and candidate-detail components load through React Suspense. Validate map rendering and candidate actions as well as Operations before publishing.

This web deployment does not provision a separately hosted Python analytics worker or live facility connectors.

Clean-runner verification also exposed missing ML extras and checkout conversion of checksum-bound fixture bytes. CI installs the ML extras, and Git preserves the fixture bytes without text conversion. The private canonical-engine package is not published into this public repository: dependency tests verify a 503/no-result failure when absent and the real adapter when installed. A green public CI run therefore does not certify the private optimizer deployment.

Live browser checks exposed an initial-refresh/import race. Workload imports now invalidate only when scenario inputs or interval values change, not when assessment timestamps refresh. The browser regression holds the initial overview response until after CSV ingestion to exercise this explicitly. Known TSO identities also take precedence over conflicting fallback catalogue roles; joint TSO/DSO labels still require a distinct mapped DSO. Production map validation waits for layer readiness rather than a fixed delay.
