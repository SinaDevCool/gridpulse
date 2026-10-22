# Independent GridPulse solutions

## Decision

Two business solutions in one modular application, repository and deployment. Site Selection serves development/investment decisions; Facility Operations serves power/battery/workload assessment. Neither requires the other's project records. There is no new calculation engine, database, entitlement store or equipment-control integration.

## Ownership and dependency register

| Owner                      | Existing modules                                                                                                                                                                                        | Responsibility                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Site Selection             | power-finder, site-portfolio, properties, anonymous-workspace, assessments, grid-connection, activation, constraint-exposure, data-centre-planner, legacy-planner, map, operator-enquiry, grid-forecast | Site briefs, candidate screening, project evidence and connection investigation                                |
| Facility Operations        | features/operations, server/operations, lib/operations-*                                                                                                                                                | Scenario inputs, evidence validation, assessment lifecycle, battery response and workload recovery             |
| Shared domain-neutral      | shared, features/theme, config/solutions                                                                                                                                                                | CSV mechanics, theme and solution identity/availability                                                        |
| Composition/infrastructure | routes, components/product, integrations/supabase, lib/analytics-api, features/analytics                                                                                                                | Routing/chrome, identity transport and existing versioned analytics interfaces; not a universal business model |

The architecture checker rejects direct (including type/dynamic imports) and transitive runtime imports between solution-owned modules. Shared foundations cannot depend on either business domain. Existing analytics contracts remain an explicit shared integration surface: facility planning and grid studies retain their distinct request schemas and endpoints. No planning model is imported into Operations.

The historical grid-connection/operations-readiness module remains Site Selection-owned: its actual consumer is OperatorEngagementControl. It is not a second Operations engine and is not moved or duplicated merely because its filename contains operations.

## Availability is not authorisation

`GRIDPULSE_SOLUTIONS=all` (default), `planning`, `operations` or `planning,operations` is compiled by Vite for matching browser/server availability. Invalid values fail the build. Rebuild to change it. Legacy GRIDPULSE_PRODUCT_MODE controls retained demo/workspace functionality, not a subscription. Private Operations handlers retain bearer/facility checks. Demo navigation never grants private data access. Persisted per-customer entitlements are deliberately deferred: adding them requires a separately approved identity/data design, not a browser flag.

The same registry drives navigation, route ownership and the Worker boundary. Disabled solution pages/APIs return 404 before their handler executes. Assets/platform pages stay available. Existing bookmarks and Operations query parameters remain unchanged. API responses identify their solution via x-gridpulse-solution.

## Frontend and onboarding

ProductShell replaces FinderShell rather than adding parallel chrome. Existing CSS class names are retained for visual compatibility, not business ownership. Solution-specific introductions live at /solutions/site-selection and /solutions/facility-operations. Operations starts from its own synthetic facility scenario; configure Inputs & evidence or upload historical records. It neither reads nor creates a Finder project. An Operations-only deployment uses its own introduction at the root.

Finder persistence remains gridpulse-finder IndexedDB plus gridpulse-finder-active-project. Operations panel preference remains gridpulse-operations-inputs; scenarios/drafts/imported evidence remain session memory with the existing leave guard. Operations query keys use the operations prefix and calculation version. Shared theme preference is intentionally global. No reset action or migration crosses these stores. Switching Operations views preserves draft state; leaving the solution warns about unsaved edits/imported evidence. Confidential imports are not silently persisted.

## Backend

Existing /api/power-finder/* and /api/operations/* endpoints, schemas, calculations and repositories remain. Operations assessment uses OPERATIONS_RATE_LIMITER (namespace 1002); Finder retains its limiter (1001). The same existing 600/60 policy is retained. Missing Operations limiter returns 503 instead of silently removing protection. Existing database authorisation is unchanged. No schema/data/billing changes or PR #37-only backend additions are needed.

## Optional handover contract — specification only

There is no automatic sync or handover UI until a customer workflow requires it. A future `gridpulse-site-facility-handover-v1` should contain source project/site id, exportedAt, location metadata and evidence references with source timestamps and confirmation status. The receiver creates a draft, records provenance, validates the contract and asks an authorised reviewer to confirm operating limits. Mapped voltage and screening headroom must never populate an approved import limit automatically. Later changes require another explicitly reviewed snapshot. Do not add a generic shared Site/Facility aggregate or database tables pre-emptively.

## Verification and release

Focused solution/configuration/server tests and existing navigation/leave-guard tests cover the boundaries. Architecture tests check forbidden dependencies. Browser checks cover introductions, direct Operations entry without a project, state isolation and no eager map requests. Existing compiled runtime tests protect calculations and authentication. Full regression stays sequential locally and broad Finder checks remain in CI. No separate services/microfrontends, duplicate auth or speculative packages are introduced.

Release starts from production main, retains PR #38 calculations and excludes parked PR #37 migrations, workspace-reader changes and Python runtime additions. Roll back the deployment version or revert this release commit without rewriting published history. Product access billing and separate deployments remain explicit future decisions.
