# Application boundaries

Routes validate URLs and compose feature screens. React components render; lifecycle hooks coordinate
requests and imports; domain modules own numeric calculations. Infrastructure adapters own databases,
HTTP, browser storage and external resources. No second optimizer is implemented in the web application.

## Existing public entry points

- OperationsDashboard composes overview, scenario editor, Compute & Workloads and Power & Battery.
- The Finder route composes useFinderController and FinderScreen. Rendering sections have no data-fetch lifecycle.
- Finder effect groups own viewport/ranking loading, project persistence, operator selection, capacity and studies.
- Finder state is separated into project, data, map, discovery, capacity and interaction hooks; the URL schema has one owner.
- PowerFinderMap owns the React effect boundary; map resources, initialization, sources, layers and interaction registration are separate.
- Analytics contracts own acknowledgement, summary and complete job shapes. Browser clients validate responses.
- JobSubmission owns fingerprint deduplication. JobRunner owns status changes; registered handlers own calculation calls.
- Store/database RPCs retain owner, attempt, cancellation and lease guarantees.
- Submission and execution depend on separate narrow store protocols, not the full worker storage interface.
- The public and privileged Operations repository paths use different credentials.
- Request diagnostics use async-local context; no mutable global last-error slot remains.
- Assessment and strategy database queries live in feature repositories, not presentation components.
- Operations accepted-import metadata is workspace-scoped and retains provenance without claiming dispatch verification.

## Styles

product.css and operations.css are ordered manifests. Their extracted sections retain the exact AST
rule order. Product styles deliberately retain their established cross-feature cascade through the
compatibility manifest; Operations remains route-scoped. Identical global output hashes establish
that the initial structural extraction did not change the compiled cascade. A subsequent intentional
Finder detail contrast correction is recorded separately. The verification script compares all ordered
rules and declarations against the baseline and allows only that specific correction. Non-adjacent overrides are not
deleted as duplicates. Narrowing the cross-feature cascade requires a separate visual migration.

## Enforcement

Run npm run check:architecture alongside typecheck, lint, unit, database and browser tests. The
baseline is a ratchet, not a recommendation that long functions are good. New modules have a
500-line review budget and new functions a 300-line budget; retained/extracted legacy hotspots
cannot grow past their current baseline without explicit review. Generated files are excluded.
Runtime import cycles are rejected; type-only imports are not treated as runtime dependencies.
The deployment workflow runs the architecture gate before unit tests and build.

The refactor scripts use syntax trees for mechanical extraction and TypeScript's import organizer.
They refuse accidental target overwrites. Applied migrations and generated contract files are not rewritten.
