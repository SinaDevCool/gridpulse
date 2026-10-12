# Productive application modular refactor

Baseline: f4b6767; 347 TypeScript tests, 193 Python tests, no app lint errors.
Public APIs, numeric calculations, evidence classes and UI layout are compatibility boundaries.
Applied migrations, generated files and the private capacity engine are not rewritten.

## Ownership

| Responsibility               | Single implementation owner                                    | Evidence boundary                                  |
| ---------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Candidate ranking            | power-finder/candidate-intelligence and ranking-config         | investigation priority, not capacity               |
| Operator identity            | power-finder/operator-normalization and candidate-detail-model | mapping, not connection approval                   |
| Scenario demand and recovery | operations/scenario-engine                                     | demonstration assumptions                          |
| Battery interval physics     | operations/battery-dispatch                                    | explicit configuration                             |
| Workload eligibility         | operations/workload-intelligence                               | declared deadlines and telemetry                   |
| Historical alignment         | operations/operations-service                                  | accepted input evidence, not dispatch verification |
| Operating envelope           | operations/operating-envelope                                  | qualified by input evidence                        |
| Canonical facility planning  | private capacity_backtest application via adapter              | fail closed without engine/model                   |
| Network studies              | grid_data/network_study provider                               | model and contingency dependent                    |
| Job leases and cancellation  | api/store and database RPCs                                    | owner/attempt scoped                               |

## Dependency policy

Domain calculations may depend on domain contracts, not React, routes, HTTP clients or storage.
Routes compose use cases; infrastructure implements their ports. Browser clients never import
privileged server adapters. Transport schemas own response validation. Numeric results are not
reimplemented in view components. Type-only dependencies are not runtime cycles.

## Product surfaces

The source of truth is src/config/product-mode.ts. Finder exposes anonymous Sites, Finder and
Operations; connect/full retain additional capability policies. Retired routes retain their redirects.
Dormant code is extracted, not deleted merely because finder mode hides it.

## Phase checklist

- [x] 0: characterization and architecture protection
- [x] 1: contracts and transport boundaries
- [x] 2: Operations components, imports and assessment lifecycle
- [x] 3: shared CSV parsing with separate domain validation
- [x] 4: Python runner, handler registry and repository contracts
- [x] 5: backend routers, submission and request-scoped infrastructure
- [x] 6: Finder state and map lifecycle decomposition
- [x] 7: CSS ownership and visual equivalence
- [x] 8: portfolio and advanced workspace extraction
- [x] 9: dependency/complexity enforcement and full validation

Each check means implemented and validated, not simply moved. Compatibility shims must contain
no duplicate implementation. Mechanical extraction and intentional behavior fixes are reviewed separately.

## Structural results

| Entry point                         |      Before |     After |
| ----------------------------------- | ----------: | --------: |
| OperationsDashboard                 | 1,118 lines | 277 lines |
| PowerBatteryView                    | 1,318 lines | 372 lines |
| ComputeWorkloadsView                |   812 lines | 495 lines |
| Finder route                        | 4,446 lines |  27 lines |
| PowerFinderMap                      | 2,068 lines | 571 lines |
| Python application factory          |   735 lines | 213 lines |
| Python executor compatibility entry |   635 lines |  26 lines |

Smaller entries delegate to explicit modules, not a second calculation implementation.
Large retained domain algorithms and coordination hooks have a complexity ratchet; this does not
claim every legacy function is below the new-module budget. React composition remains functional;
classes and protocols are used where stateful execution or infrastructure benefits from them.

## Validation and intentional differences

- 367 TypeScript tests and 195 Python tests passed.
- Typecheck, app lint, encoding, PostgreSQL ownership/ingestion/RLS/cancellation, production build,
  performance budgets, public Finder access checks and production dependency audit passed.
- 33 Operations browser checks passed; all three views also passed desktop/mobile screenshots in both themes.
- Ordered CSS verification: 17,392 product nodes and 2,941 Operations nodes retained. The sole
  intentional value change improves candidate-summary text contrast.
- Imported scheduler/GPU evidence persists across tab changes. Restoring the scenario clears its
  imported backend assessment. Power imports cannot overwrite newer imports or changed inputs.
- Retired-layout browser selectors were updated rather than preserving obsolete UI elements.
- Workbook and regional-discovery workflow tests use the checked-in published dataset. A separate
  forced-outage test confirms no results are invented. Live regional sampling was unavailable in
  an earlier run; passing these deterministic tests does not establish upstream service health.
- Finder validation: 47 checks passed in the full run. One comparison check exceeded its old
  five-second loading assertion under concurrent cleanup; the explicit loading timeout was corrected,
  and that check passed separately against the unchanged implementation. All 48 checks were verified.
- No SQL migrations, private-engine implementation, production data, git history or deployment changed.

## Next-level refactor — 2026-10-12

Protected first-pass checkpoint: `18cbd26`. This pass changes the productive app and its API adapter,
not the private analytical engine. UI structure, CSS cascade, ranking formulas and facility calculations
remain unchanged. One-off transformation scripts were removed after use; reusable extraction tools remain.

### Phase implementation

1. **Owned contracts:** Finder data/actions, Strategy, Map resources, Compute and Portfolio have static
   contracts. Leaf views use narrow field selections. Assessment result types follow the request kind;
   assurance responses validate nested quality, verification, compliance and economics fields.
2. **Operations lifecycle:** evidence uses atomic reducer transitions; presentation preferences have
   a separate context. Capability status has one shared query and cannot fail the calculation query.
   Workload/power imports abort superseded requests, retain revision checks and clear file inputs in
   `finally`. Assessment cache identity includes calculation version. Lifecycle metadata distinguishes
   ready, loading, stale, failed and cancelled. Strategy input/profile changes invalidate pending results.
3. **Finder composition:** pure filtering/ranking selectors, candidate projection, editing, map
   presentation and persistence have separate owners. Regional sampling is outside JSX, captures input
   identity and stops later batches/retries after cancellation. Existing URLs, mapping and scoring remain.
4. **Map lifecycle:** registration modules depend on explicit resource contracts and narrow references.
   Overlay/source installation is idempotent. Interaction subscriptions are disposed before replacement
   and removal. Late cluster-expansion results cannot act on a removed or replaced map.
5. **Persistence:** numbered repository operations have semantic names. User-token reads and privileged
   calculation writes have separate adapters. Reads use an allowlisted table contract and bounded row
   limits. Preferred strategy, decision/actions/activity, flexibility profiles, simulation versions and
   package versions use transactional RPCs. Busy-state cleanup runs in `finally`; application decision
   and preference commands return typed outcomes without browser prompts or React setters.
6. **Python boundaries:** routers receive explicit dependencies. A typed handler registry and injected
   publisher, clock, solver factory and checkpoint isolate calculations from raw credentials. Job results
   cannot overwrite a cancelled or replaced attempt. The repeated unavailable-executor methods became
   one executor. Shared browser/Python fixtures cover lifecycle metadata, not fabricated business results.
7. **Presentation:** Portfolio state and views are separate; Compute has separate state, queue,
   recommendation and presentation modules. Finder comparison, operator evidence and security study
   sections are separate. No new styling framework, optimizer or state-management framework was added.
8. **Enforcement:** architecture checks include dynamic imports, server-only boundaries and hook-derived
   contracts without resetting the size baseline. Scoped unused-variable and type-aware promise checks,
   frontend PR CI, reducer/component/use-case tests, database transactions and Workers-runtime HTTP tests
   protect the new boundaries. Production health checks remain separate from deterministic regressions.

### Release and safety boundaries

- Apply `20261012190000_atomic_strategy_commands.sql` before deploying this application revision.
  It is forward-only, uses invoker rights and checks assessment permissions. It has **not** been applied
  to production. Local PostgreSQL tests verify rollback, ownership, preferred uniqueness and version
  allocation; real Supabase RLS/JWT and concurrent multi-connection staging verification remain release gates.
- Cancellation is cooperative at handler checkpoints and client waiting boundaries. A running private
  solver is not forcibly interrupted. Database owner/attempt checks remain the final result authority.
- Legacy ledger publication retains existing upsert identities and checks the job checkpoint before
  publishing. This does not claim an atomic, exactly-once transaction across every legacy ledger write.
- No push, deployment, production-data mutation or published-history rewrite was requested or performed.

### Validation for this pass

- TypeScript: 381 tests; typecheck, lint and architecture ratchet passed.
- Python: 200 tests; API Ruff lint and formatting checks passed.
- Operations: 33 UI/accessibility/layout checks plus 3 real Workers-runtime HTTP checks passed.
- Database: Operations migration/integrity suite and Strategy transaction suite passed.
- Production build, performance budgets, text encoding, public-access checks and dependency audit passed.
- Finder: all 48 checks passed in the final full run. The earlier nested-label lookup was replaced
  with a semantic combobox locator; the control itself was unchanged. Third-party basemap glyph
  warnings remain external-service warnings, not a claim that those services are always healthy.

Measured active-file sizes after this pass: Portfolio route 40 lines, Compute entry 14, Finder detail
485, Finder stage 432, Finder composition controller 743, Strategy controller 318, Python API app 152.
The composition controller retains explicit wiring rather than introducing a second store or opaque
generic framework. Its filtering, map presentation, editing, persistence and sampling logic live elsewhere.

### Release validation — 12 October 2026

Fresh validation passed: 381 TypeScript tests, 200 Python tests, typecheck, lint,
architecture, Operations database checks, 36 Operations UI/runtime tests, build,
performance budgets, production dependency audit and public-access security checks.
Both new Strategy migrations were applied to the linked database. Live verification
found inherited anonymous function grants; the forward-only privileges migration
removes them, and regression tests now simulate Supabase default grants.
All five commands retain invoker rights and authenticated execution; an unauthorized
editing probe was rejected. The deployment workflow now runs transaction and runtime
checks. Separate Python analytics hosting and staging multi-user validation remain
external deployment requirements; this web release does not provision those services.

Clean-runner release validation additionally found an ignored workbook dependency and
an early-interaction hydration race in map-layer checkboxes. The fictional workbook is
now a versioned test fixture. Layer controls remain disabled until client initialization;
the regression checks both the server-rendered disabled state and enabled interactions.
