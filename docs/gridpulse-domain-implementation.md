# Domain evidence implementation and activation runbook

Date: 28 October 2026. This change set implements the code path described in `gridpulse-domain-development-plan.md`. Software qualification, engineering approval and production activation are separate gates.

## Implemented phases

| Phase | Delivered code | Remaining activation gate |
|---|---|---|
| 0: baseline and ownership | Paired branches from the released Product and Engine baseline; existing API, solver and ownership model retained | Record final commit/wheel/artifact hashes in release CI |
| 1: evidence quality | Strict connector parsing, missing-channel coverage, finite values, revision conflicts, cutoff safety and manifest-aware readiness | Real meter boundaries, verified provenance and reviewer approval |
| 2: report corpus | Ten independently authored report summaries with source hashes, physical pages, applicability, excluded uses and corpus fingerprint | Independent subject-matter review; summaries are editorial review only |
| 3: checked findings | Versioned findings tied to owned assessment facts, report revision and source inspection; legacy clients retained | Production candidate qualification |
| 4: investigations | Scoped evidence questions, explicit alternative calculation, Engine-produced metric differences, content-bound brief review and export digest | Operator usability review |
| 5: evaluation | 69-case combined suite, 27 new domain cases, expected guidance/actions and provider-call accounting | Independent expert labelling; repeated provider qualification is recorded separately |
| 6: intake/calibration | Offline JSON/CSV component intake, immutable review artifacts, workload and cooling candidate pipelines, local review UI | Permission, measured captures, held-out acceptance and engineering approval |
| 7: uncertainty/repeated events | Bounded independent/common-command analysis and chronological state handoff through owned jobs; private UI capability gate | Private deployment and site validation; no market enrolment |
| 8: cooling | Topology/heat-rejection metadata, chronological row availability, training/holdout checks and finite measurements | Physical thermal safety and model operating-range review |
| 9: Meta controls | Stage receipts, reduced transcript disclosure, country policy and optional atomic shared-budget coordinator | Account controls, approved shared storage/retention and deployed binding |
| 10: integration boundary | Read-only connector review, assumptions and unknown permissions remain explicit; no control endpoint | Partner protocol/version, source permission and site authority |
| 11: qualification/release | Managed sequential validation and local budget-runtime qualification | Exact paired CI artifacts, hosted public/private smoke tests, then demo and separately reviewed public snapshot |

## Defaults and isolation

`COPILOT_ANALYSIS_ENABLED` defaults off. Public MILP sessions cannot use the private analysis panel. All requests remain owner-scoped and reviewed before submission; uncertain submissions recover through existing job history. Changing the baseline invalidates the associated UI context. Independent scenarios are not described as one common implementable dispatch. New analysis results remain a separate review view; the existing plan brief attaches the explicit baseline/alternative experiment, not arbitrary analysis jobs.

The optional budget service in `deployment/copilot-budget/` is code only. Production Wrangler configuration is unchanged. Required-but-unavailable budget admission fails closed. Unknown usage remains reserved. This does not create a provider spending cap or cover requests outside GridPulse.

No database migration, physical command, public source publication or production deployment occurs as part of local implementation. PR #37 remains parked.

## Offline component intake

From the Engine repository with its qualified environment:

```powershell
.venv/Scripts/python.exe -m capacity_backtest.application.evidence_intake capture.json metadata.json review-output
```

Capture accepts the existing component-observation JSON or exact-column CSV schema. Metadata requires exactly: dataset_id, facility_id, source_id, content_sha256, permission_reference, licence, planning_cutoff, truth_class, meters and intervals. Use ISO timestamps with explicit timezone. SHA-256 covers raw capture bytes. Each meter declares its component, unit and measurement identity; include PCC. Every expected interval is retained, including missing values. Future-available rows are excluded and block acceptance. Permission text and hashes establish a declaration and integrity, not authenticity or authority.

Keep raw data and generated reviews outside version control. Import only the generated component review into the browser's local evidence review. It is inspected locally; it neither uploads a dataset nor changes an active model.

## Offline calibration

```powershell
.venv/Scripts/python.exe -m capacity_backtest.application.calibration workload.json workload-metadata.json candidate-output
.venv/Scripts/python.exe -m capacity_backtest.application.calibration cooling.json cooling-metadata.json cooling-output --kind cooling
```

Workload mode retains the existing training/validation/test manifest and training-only fitting. Cooling capture contains training and holdout objects, each with aligned arrays: it_mw, temperature_c, cooling_mw, timestamps and available_at. Metadata supplies dataset_fingerprint, topology, heat_rejection, permission_reference, evidence_cutoff, train_end, holdout_start and truth_class. Rows must be strictly chronological, available before cutoff, and inside the declared split. Supply the fingerprint of the independently verified source dataset. The output is a review candidate, never automatic activation. Synthetic captures cannot become measured approval.

Cooling fits aggregate electrical demand. It does not validate rack/coolant thermal safety, heat reuse or transferable report savings. Engineering review must check measurement boundary, topology, load/temperature range and acceptance thresholds before any model activation.

## Qualification and release

Run local jobs sequentially through the managed lock, with at most two unit workers and one browser worker. `node scripts/qualify-copilot-budget.mjs` typechecks and exercises the standalone coordinator in local Workers SQLite, including concurrent admission and restart persistence. Keep provider evals separate from deterministic tests and report unique questions versus repetitions, failed runs, paid stages and editorial/expert review status.

Pair the exact Engine wheel with Product API in CI; retain source hashes, lock hashes, corpus fingerprint, request/result fingerprints, test reports and rollback artifact. Never publish fixture URLs/keys or rebuild a different candidate in a publishing job. A local pass does not establish a hosted deployment. Keep private analysis disabled until a private-session smoke test passes on the exact candidate.

A public snapshot requires a fresh disclosure review of the code delta. Exclude raw data, provider keys, private history, personal documents, test captures and local operational reports. Record the actual deployed version in the demo. Real-world calibration, market qualification, commercial claims and physical operation remain blocked until their external evidence is supplied.

## Local qualification record

The implementation passed the full Product unit run (773 passed, one deliberately skipped), followed by focused tests for later routing/export changes. The focused post-change run passed 164 tests; the final digest/routing/genuine-contract run passed 16. Counts overlap and must not be added together.

Typecheck, architecture/complexity, encoding, tooling and lint passed. One pre-existing Fast Refresh warning remains. The compiled fixture build passed performance budgets. All 12 fast browser checks passed on the scenario compatibility artifact; the separate compiled public MILP journey passed, including desktop/mobile evidence, confirmed alternatives, review and independently recomputed JSON export digest.

The final locally built pair (core 0.2.0 and Engine 0.2.4) passed 41 tests from installed wheels, including the genuine 96-interval solve and all three owned analysis HTTP methods. The SQLite coordinator passed local Workers concurrency, duplicate, unknown-usage, reconciliation, persistence and month-isolation checks. Wheel hashes and synthetic reports are retained locally, not as public customer evidence. CI must reproduce the pair from committed source.

Live Meta development evaluation exposed two report-routing failures and, on the next run, one benchmark-routing failure. Each was corrected with a regression; failed reports are retained. Final repeated evaluation is recorded against the frozen candidate commit under the ignored local qualification reports. These application-authored checks do not establish independent expert accuracy or operator usability.

A further frozen-candidate run exposed the same unrequested PUE definition in a cooling comparison. The interpreter now validates that semantic reference and uses matching reviewed guidance (or clarification) rather than accepting the unrelated definition. Regression tests cover the injected erroneous provider output. Connector tests also cover whitespace and array-valued measurements without zero coercion. The post-fix server/connector suite passed 116 tests and all tooling checks passed.

CI also caught an older incomplete rolling-window mock; its accepted fixture now includes forecast/scenario evidence and explicitly checks that the old incomplete payload is rejected. Eight focused API tests passed. A repeated live run passed 69/69 once, then exposed an occasional refusal on unqualified connection-capacity proof. Such proof questions now deterministically select evidence readiness. The follow-up server suite passed 111 tests; tooling checks passed again. These earlier reports remain development evidence, not the final repeated qualification.

The readiness boundary also covers explicit protocol-readiness and approval questions, following an intermittent OpenADR refusal in repeated evaluation. The updated server suite passed 112 tests, and checks passed. The Engine remains paired with API revision 08f1d839289105c71ed33cd7698244676db699ae: its services/grid-data tree is identical to the subsequent copilot-only fix (bf15eaefbc5d7d1cb79a4338f3115fac2f8ca5d7). Server-only copilot routing is qualified separately; it does not change the installed Python pair.
