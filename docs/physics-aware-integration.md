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
