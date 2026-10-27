# Evidence-based operational analysis implementation

## One calculation owner

GridPulse-Fullb owns MILP, replay, interval-weighted financial accounting, calibration and qualified model artifacts. The product owns authentication, job submission, bounded question interpretation, checked result projection and UI. No second optimiser, queue, database, agent framework or training service was added. Public admission is unchanged; private experiment/accounting jobs reuse the existing historical-replay job lifecycle.

## Implemented phases

1. **Numerical/input foundation:** economics integrates each interval duration. Telemetry rejects nonfinite values, incompatible component units, invalid hashes and inconsistent missing values. Alignment normalises timestamp instants, validates thresholds and rejects duplicate axes. Energy-balance assessment rejects nonfinite inputs.
2. **Capability contract:** one provider-neutral inventory advertises read-only queries, reviewed separate calculations and unsupported causal analysis. The interpreter accepts up to four strictly typed queries in one provider request. Legacy single-query provider selections remain accepted during transition. The browser/server conversation protocol is explicitly versioned v2 for coverage and multi-query responses; the production health check expects that version. Neither provider can submit jobs or generate accepted numerical evidence.
3. **Question coverage:** bounded composition reuses existing deterministic selectors. Each requested query has a coverage status. Workload facts are namespaced when several queries are combined. Readiness and diagnostic answers distinguish checked results, possible drivers, required measurements and next steps. Queries exceeding evidence limits ask for a split instead of silently dropping results. PUE has its own definition; fixed-schedule pricing is distinct from objective changes. Per-job baseline movement is explicitly unavailable, rather than inferred from earliest-start constraints.
4. **Knowledge retrieval:** the server owns a ranked, versioned corpus of independently authored public-source summaries. Each includes source, section, applicability, editorial status and redistribution boundary. The corpus is not trained data, customer telemetry or an expert approval. No source pages are fetched on user requests. Add reviewed records here before adding another retrieval system. Private documents require a separate permission/retention implementation; they must not be inserted into this public corpus.
5. **Analysis tools:** the existing review component exposes all nine engine experiment fields in qualified private sessions. Every calculation requires explicit review, preserves the baseline and retains job/result identity. Public sessions keep the existing three supported alternative-plan controls. The accounting tool prices the accepted fixed schedule through Python with one explicit tariff per interval; the first UI offers a flat EUR/MWh tariff. It does not optimise cost, calculate a retail bill or infer demand-charge rules. Unknown submission outcomes are not automatically retried.
6. **Answer presentation:** evidence cards prioritise plan peak, target, reserve and completion rather than arbitrary array order. Partial/unsupported coverage and source applicability are discoverable. Follow-ups preserve bounded resolved-query context; a new baseline clears it.
7. **Calibration qualification:** the GPU calibration record retains its training-derived measured-power curve. Approved model loading verifies content, release inclusion, held-out thresholds, approval time, measured provenance and operating range. Serving never trains or automatically promotes a model. The existing conservative cap model is not silently replaced by an empirical estimate.
8. **Evaluation/release:** the existing live qualification harness has additional domain cases. Unit tests cover multi-part questions, partial support, PUE, readiness, tariff routing and over-budget outputs. Genuine cross-repository API tests exercise solver, replay and accounting with owned baseline reconstruction. Use exact tested source/wheel/lock identities for a later release; uncommitted work is not a qualified production artifact.

## Input requirements and remaining external gates

- **Measured calibration:** authorised PCC/battery/GPU/workload and cooling observations, unit and boundary metadata, calibration status and chronological held-out splits. No such site dataset has been supplied or promoted by this change.
- **Knowledge review:** engineering/operator review is required before treating editorial summaries as an operating procedure. Product output remains read-only decision support.
- **Quality evaluation:** live-model success and schema compliance are not expert accuracy. Score complete question coverage, numerical grounding, scope, uncertainty, useful next action and appropriate refusal. Extend the evaluation set with anonymised real energy-manager questions; record reviewer, expected evidence and allowed gaps. Do not train on this test set.
- **Public experiments/accounting:** deliberately disabled by the existing public job admission. Enabling them requires separate qualification and approval of admission/storage configuration, not a hidden bypass.
- **Deployment:** no deployment, production schema/billing change or PR #37 activation is part of this work. Both repositories need exact candidate commits and remote qualification before release.

## Validation commands

Product: use `verify:local -- operations`, focused server tests, sequential `verify:local -- checks`, then build and the existing canonical-results browser spec. Engine: focused accounting/measurement/calibration/experiment tests and the planning marker with the existing API-capable Python environment. Cross-repository API integration uses the exported engine fixture and the existing job runner. Keep all heavy stages sequential.


## Local verification in this implementation

- Engine planning regression: 102 passed (API-capable existing environment; 279 non-planning cases deselected).
- Genuine cross-repository API/job integration: 4 passed, including owned stress replay and fixed-schedule accounting. No network/database writes.
- Operations unit suite: 285 passed, one existing skipped test.
- Final focused server/copilot/contracts unit suite: 70 passed.
- Browser fast gate: 12 passed; canonical MILP/copilot desktop/mobile flow: 1 passed. The browser used a synthetic display fixture and mocked transport, not live physical execution. The mobile alternative screenshot was inspected.
- Final sequential encoding/typecheck/architecture/lint checks passed with the versioned conversation protocol. One existing Fast Refresh warning remains in visualization.tsx.
- Final production build and asset budgets passed; no artifact was published.
- Live Meta: 24 questions through the local production handler with owned retrieval replaced by a display-only synthetic fixture. A subsequent focused three-question run verified diagnosis, multi-part power/battery/workloads (including the missing baseline-movement gap), and tariff-accounting routing. No live solver/production claim follows from these provider calls. The expanded hosted qualification corpus remains opt-in; it has not been run in full against production.
- No real site calibration, expert sign-off, production activation, migration, commit or push was performed by this implementation.
