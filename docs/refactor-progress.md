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
