# Physics-aware engine integration

## One engine and one job lifecycle

The Python implementation remains in GridPulse-Fullb. This repository adds strict experiment transport, owner-scoped baseline lookup and UI/explanation integration. POST /v1/jobs/facility-experiment reconstructs the input from the owner's completed facility_plan job; browser-supplied baseline results are never trusted. Existing facility_historical_replay storage, idempotency, leases, cancellation and isolated child execution are reused. GET /v1/jobs/{id} remains the only polling/result route.

The existing rolling-facility-plan endpoint accepts the new gridpulse-chronological-shadow-request-v1 variant and dispatches through the same rolling job handler. The existing rolling benchmark contract remains supported. No schema change is required for private job types already admitted by the deployment.

## UI and copilot

AlternativePlanReview reuses useMilpCalculation and the normal accepted-result projection for separately re-optimised alternatives. Authenticated, non-public sessions may select a fixed-plan stress test with an explicit reviewed change. Stress results retain their own receipt and do not replace the displayed baseline. The three UI controls cover battery energy, discharge power and import limit; the engine API additionally supports duration, availability, generation, initial SOC and cooling scenarios.

A completed experiment may be attached to the conversation. Follow-up stress questions load the same owner's completed experiment and verify its baseline fingerprint before showing checked facts and violation codes. Numeric statements are constructed from returned evidence; no language model invents scenario numbers or executes a solver. General operational knowledge is separately labelled and does not establish causality or a reliability probability.

## Public compatibility

The current public mock runtime and atomic admission function accept facility_plan only. Experiments are deliberately disabled in that mode. Existing public alternative calculations continue through the normal admitted plan path. Enabling public experiment jobs requires a separately reviewed admission/storage change; no Supabase schema/data change is included here.

## Qualification

Use the existing resource-safe local runner for changed TypeScript tests and checks. Python API tests include owner isolation, stale-result rejection and idempotency. The optional cross-repository test runs only when GRIDPULSE_EXPERIMENT_FIXTURE identifies an exported request from the existing Fullb tests/test_application_facility.py fixture. Set PYTHONPATH to this services/grid-data/src and the Fullb src; use an environment with FastAPI, NumPy, SciPy and both packages. This test runs the actual solver in the existing isolated job runner, without network or database access.

No new production service, API secret, paid infrastructure or deployment was created. Calibration with real site measurements, checkpoint-state qualification, public stress activation and production artifact promotion remain explicit future gates, not silently implied capabilities.

## Research implementation checkpoint — 2026-10-27

Audited starting revisions: product `4b2c0b5` in `codex/copilot-provider-analysis`;
engine `a447b82d` in `codex/milp-quarter-hour`. The older main checkout was not
used as the implementation base. PR #37 remains excluded.

| Phase | Existing owner reused | Changes and qualification boundary |
|---|---|---|
| 0: contracts | Existing conversation, facility, experiment and accounting contracts | Additive investigation/report metadata; no new solver, queue, database or job lifecycle. |
| 1: operational knowledge | `operational-knowledge.ts` and the existing guidance disclosure | Reviewed EDNA scope summaries, source IDs, page references where verified, applicability and prohibited uses. Reports are not calibration data. |
| 2: measurements | Fullb component adapter, meter contract and observation alignment | Explicit sample semantics/sign/uncertainty; bounded energy-preserving aggregation; counter-reset, gap, revision and cutoff checks. Partial coverage returns unknown, not zero. Offline component captures use this same integrator. |
| 3: datasets | Fullb immutable artifact store and existing capture adapters | Bounded chronological dataset manifests, execution identity separation and rejection of split-crossing/future records. Existing ENTSO-E parser now handles explicit EUR/MWh A44 prices. No bulk dataset download or new source service. |
| 4: workload calibration | Existing execution adapter and held-out profile fitter | Reference work duration, configuration and GPU measurement boundary; real-data qualification blocks missing references. Conservative power-cap semantics remain unchanged. |
| 5: physical qualification | Existing cooling calibration, battery replay and thermal module | Topology-labelled calibration, operating-range and identifiability gates; optional single-zone temperature replay with explicit capacity, conductance and COP. It is offline research, not rack/coolant safety or a replacement MILP model. |
| 6: repeated events | Existing rolling planner and experiment executor | Recovery continues after compute/event completion with carried states and terminal targets. Alternative cases expose returned comparison quantities. Frozen replay and re-optimisation remain distinct; no calibrated probability or robust common-plan optimiser is claimed. |
| 7: economics | Existing accounting job and tariff review | Flat or interval price lists, including negative prices. Calculations stay in Fullb. Full retail bills, historical demand-charge ratchets and market qualification remain outside energy-only accounting. |
| 8: investigations | Existing bounded analysis executor | Untested hypotheses, required site evidence and reviewed next action are structured separately from numerical facts. No autonomous calculation or control. |
| 9: UI | Existing conversation/guidance/accounting components | Progressive disclosure for investigations and report scope; interval tariff review retains confirmation, owner identity and baseline checks. |
| 10: qualification | Existing managed runner and cross-repository job test | Focused engine/product checks, sequential broader qualification, and actual solver-to-job integration. Release manifests remain SHA/wheel/lock-bound; nothing is published by these checks. |

The private analysis boundary is intentional. This change does **not** enable
customer uploads, experiments or accounting through public admission. The source
library remains in the existing research skill; no copyrighted PDF corpus was
copied into the web bundle. B03 display-market material and the residential policy
briefs are not used to infer data-centre operating parameters.

### Evidence needed before operational qualification

Supply authorised, synchronised PCC/IT/cooling/battery observations and scheduler
execution records, plus site topology, permissions, tariffs and thermal equipment
limits. Approve held-out calibration artifacts for the exact facility/configuration
and release. Operator review, checkpoint/migration carryover qualification and
common-plan robust optimisation are still gates; independent scenario solves do
not satisfy them. No learned model is trained or promoted automatically.

### Local verification of this checkpoint

- Fullb: 116 affected planning/application/physical tests passed; the subsequent
  cutoff-regression test also passed with the full measurement test file (10 tests).
- Actual cross-repository solver → job runner → experiment/accounting: 4 passed,
  using a fixture exported from Fullb with a five-second solve limit. No network or
  database writes. An initial fixture with a 300-second limit was correctly rejected
  by the existing 30-second experiment admission bound.
- Product Operations: 288 passed, one existing skip. Copilot/server focused checks
  passed after moving the PCC checklist assertion to its structured field and
  verifying deterministic what-if routing performs no hidden solve.
- Enabled MILP browser flow: 1 passed using synthetic responses and fixture origins;
  the earlier flag-disabled attempt was skipped and is not counted as coverage.
- Production compilation and asset budgets passed using fixture configuration;
  this artifact is not sealed or approved for publishing. Existing chunk-size/
  transient chart warnings do not establish numerical or physical validation.
- No deployment, production storage change, model training or artifact promotion.
