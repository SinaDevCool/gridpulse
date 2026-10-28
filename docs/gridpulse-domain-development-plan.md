# GridPulse domain development audit and implementation plan

Date: 28 October 2026, Europe/Berlin. Status: proposed work, not implemented.

The next release should improve evidence quality and the investigation workflow before adding more model autonomy. Keep the existing Python calculation owner, editorial knowledge corpus, authenticated job API and reviewed exports. Correct the confirmed data-quality defects first; then connect research findings to bounded investigations and existing calculations. Measurement-backed qualification is a later gate requiring authorised data.

## 1 Audit scope and exact baselines

Product repository: `GridPulse-Full`, local `950b5bac47a38436818bb7f2f1530acdf156bd86`; fetched `origin/main` is merge commit `ec965465be16dfe31dadbe2918e9eff3fc6b7273`. Their tracked file trees have no difference.

Engine repository: `GridPulse-Fullb`, local `ae332199868caad4eb9ffa3e38cc427e87e05de3`; fetched `origin/codex/capacity-backtest-foundation` is `6b60d916de97b2702cdb92550441d70f2bd4cfa6`. Their tracked file trees have no difference. Start future work from the agreed released baseline rather than assuming a newer merge SHA contains new features.

Reviewed paths cover Operations conversation, knowledge retrieval, checked claims, experiments, export contracts, connectors, Python measurement/alignment/calibration, uncertainty/rolling/delivery/market boundaries, API admission/dispatch, existing tests and release safeguards. This is a focused audit of the requested development areas, not certification of every file, infrastructure setting or live deployment. No heavy suite, provider call, hosted job or production mutation was performed for this audit. Small local probes confirmed the behaviours listed below.

Engine has existing untracked `output/`, `reports/quarter-hour-default.json`, `reports/tests/` and `tmp/`; preserve them. Do not promote their contents as qualified artifacts by association.

Repository constraints remain binding: no parked PR #37 changes, no new schema/data/billing changes without explicit authorisation, no rewritten published history. Use `codex/` development branches. Original private repositories remain development owners; the public hackathon repository receives reviewed source snapshots only.

## 2 Confirmed findings and exposure boundaries

| ID | Finding and code | Evidence and consequence | Required treatment |
|---|---|---|---|
| F01 | `src/features/operations/connector-adapters.ts`, `normalizeOpenEmsSnapshot` | Probe with three null fields returned three zero-valued measurements. `Number(null)` is zero. An unavailable reading can look measured. | Fix before real-data ingestion; retain missing/invalid status. |
| F02 | Same file, `normalizeSlurmJobs` | Probe with `checkpointable: "false"` and `preemptible: "false"` returned true for both. Missing resource/runtime information also receives defaults and a constructed deadline. | Strict permissions and explicit assumptions; imported display defaults must not become operational permissions. |
| F03 | Fullb `data_center/telemetry_quality.py`, `assess_component_telemetry` | One valid sample with two reference instants returned accepted. Only explicit missing rows are counted; expected channel/instant coverage is not established. | Reuse `observations.align_observations` and require expected channels, periods and cutoff provenance. |
| F04 | Same quality helper | Probe with NaN supplied energy returned accepted with no blockers. Aggregate energy and threshold inputs lack finite checks. | Reject nonfinite/negative aggregates and invalid thresholds at canonical boundary and HTTP DTO. |
| F05 | Fullb `data_center/data_readiness.py` | An `AVAILABLE_AUTHORITATIVE` row with `evidence_fingerprint=None` returned `dependable_claim_ready=True`. This is currently a helper, not proof of a live UI claim. | Bind declared status to verified provenance/quality/review; a label is insufficient. |
| F06 | Product `operational-knowledge.ts` | Six report records (A02/A03/A04/B02/B04/B05); term matcher explicitly accepts only single-token terms and returns four records. Several records lack PDF pages. | Extend this corpus and retrieval; do not introduce a second knowledge store first. |
| F07 | `verified-claims.ts`, `copilot-composition.ts` | All blocks are mandatory and appended even if not selected; the model primarily reorders checked text. `paragraphSources` is cleared after composition. | Preserve safeguards, add stable structured findings and evidence links, measure value of optional prioritisation call. |
| F08 | `conversation-presentation.ts`, `PlanConversation.tsx` | `answerBlocks` removes exact fact-summary strings, while fact cards render only when `presentation` is absent. This can suppress a fact in a composed answer. Static finding; verify using a component regression before changing. | Make filtering conditional on actually rendered cards, or use one structured renderer. |
| F09 | `analysis-plan.ts` | Diagnostic hypotheses and required-evidence lists are largely static across different questions/assets. | Build scoped gaps/actions from accepted evidence and approved guidance. No unsupported causal claims. |
| F10 | Fullb `assessment.py`, `market/eligibility.py` | Response timing is inferred from interval indices; eligibility compares declared requirement timing with product timing. It does not prove subinterval physical response. | Separate planning resolution, declared capability and measured qualification. Coarse same-interval delivery must not qualify a seconds-level service. |
| F11 | API `models.py`, Fullb `application/uncertainty.py` | Engine accepts `evaluation_method`, including `common_command_scenario_milp`; strict HTTP request DTO does not declare the field. It cannot select that method through this DTO. | Align explicit supported methods and contract manifest before UI exposure. Preserve historical benchmark semantics. |
| F12 | API facility routes and handlers | Exact experiment/accounting reuse `facility_historical_replay`; rolling and uncertainty routes also exist. Some payloads are nested arbitrary dictionaries and uncertainty allows up to 1,000 scenarios. | Keep existing job ownership/lifecycle, narrow schemas and qualify computational budgets/admission before exposing new tools. |
| F13 | Copilot transport, receipts, evaluation | Per-IP rate limit exists (2 requests/minute); no shared monetary cutoff. Provider receipt status describes HTTP response, not necessarily semantic acceptance. Evaluation uses substring checks plus identity/intent/provider checks. | Add budget admission and separate semantic validation outcomes; expand independent evaluation. |
| F14 | `use-plan-conversation.ts` | Baseline identity resets work, but attached experiment is outside the request-lifecycle identity; selecting it does not cancel a pending answer. | Test attachment changes during pending requests; bind acceptance to attachment identity, not only baseline/question. |

F01-F05 are reproducible helper/adapter behaviours, not claims that a live facility or production user has experienced them. F08/F10/F12/F14 identify code paths requiring targeted regression and boundary review. Do not describe them as observed production incidents.

## 3 Ownership and architecture

Use these ownership rules for every change:

- Fullb owns physical units, measurement alignment/aggregation, optimisation, replay, uncertainty, calibration and numerical comparison.
- Product `services/grid-data` owns authenticated API DTOs, admission, owned baseline reconstruction, bounded jobs and compatibility with the qualified Engine wheel.
- Product `src/server/operations` owns editorial retrieval, question interpretation, provider transport, capability checks and evidence-backed response construction.
- Product `src/features/operations` owns input review, navigation, conversation presentation and export acknowledgement.
- Meta interprets language and optionally prioritises eligible findings/actions. It does not establish measurements, physical constraints, permissions, expected savings or accepted numerical results.

Extend the existing boundaries. No new optimiser, RAG service, vector database, autonomous agent framework, queue or marketplace is required for the first release. No customer PDF ingestion into the public editorial corpus.

Target data flow:

`Authorised offline capture -> immutable provenance -> typed observations -> cutoff-safe alignment and quality -> reviewed model/calculation -> owned accepted result -> structured checked findings + scoped report guidance -> investigation actions -> separately confirmed job -> reviewed evidence export`.

Each artifact carries schema/version, input/result fingerprints, truth class, source identities, limitations and explicit non-dispatch status. A checksum detects byte changes; it does not authenticate the original publisher, validate instrument accuracy or establish operator permission.

## 4 Delivery sequence and dependencies

| Phase | Deliverable | Depends on | Release class |
|---|---|---|---|
| 0 | Freeze versions and compatibility matrix | None | Planning infrastructure |
| 1 | Fix ingestion, readiness and quality defects | 0 | Core prerequisite |
| 2 | Reviewed report findings and retrieval | 0 | Core copilot improvement |
| 3 | Structured answers and evidence navigation | 1, 2 | Core copilot improvement |
| 4 | Scoped investigations and controlled comparisons | 3 | Core product improvement |
| 5 | Independent domain evaluation | Starts in 0; gates 1-4 | Core release gate |
| 6 | Read-only dataset review and workload calibration | 1, 5 | Pilot preparation |
| 7 | Repeated-event and uncertainty qualification | 1, 4, 6 for measured claims | Private analysis |
| 8 | Calibrated cooling review | 1, 6 | Conditional on data |
| 9 | Meta cost, privacy and latency controls | 0; evaluation from 5 | Hardening; durable budget infrastructure separately approved |
| 10 | Selected read-only integrations | 1, 6, 9 | Conditional pilot |
| 11 | Staged release, pilot and public snapshot refresh | All applicable gates | Release |

Phase 5 begins with expected answers before implementation, then adds cases per change. Phase 9 data minimisation and receipts can proceed during core work; provisioning a shared budget service is a separate infrastructure decision. Work remains sequential on this workstation for heavy validation.

## 5 Phase 0 Freeze the candidate and contract matrix

Tasks:

1. Create a Product branch from refreshed `origin/main`; create the Engine branch from its agreed released tree. Record SHAs and tree IDs. Preserve current work and untracked files.
2. Record Product core version, Engine wheel version/hash, `.render-core` historical pin, dependency locks and contract-manifest fingerprint. The Product analytics dependency range alone is not an exact release identity.
3. Inventory each proposed operation with request/result schema, endpoint, stored job type, handler, owned-result validator, public/private admission and UI availability. Keep exact experiment/accounting's historical-replay storage mapping explicit.
4. Define a feature matrix: public synthetic planner, qualified private analysis, offline measured-data preparation and future physical operation. Capability labels come from server admission and qualified contracts, not a client boolean alone.
5. Record feature flag defaults, prior qualified artifact and rollback steps. No new production flags are enabled during implementation.

Files: Fullb `application/contracts.py`, `pyproject.toml`, deployment lock/build manifests; Product `services/grid-data/pyproject.toml`, `api/models.py`, `api/routers/facility.py`, `api/jobs/registry.py`, `src/features/analytics/job-contracts.ts`, deployment workflows.

Gate: a reviewer can trace one exact Product/Engine/API combination without private-history assumptions. Contract gaps are listed before UI controls appear.

## 6 Phase 1 Correct input and evidence quality

### Product connectors

Change `connector-adapters.ts` and its existing tests. Introduce explicit typed parse results with accepted records, rejected records and missing fields. Keep current display-only consumers compatible through a deliberate adapter; do not silently broaden their operational use.

- OpenEMS: distinguish absent/null/empty from numeric zero; validate field units, SOC range, sign convention and source timestamp. Do not infer an interval average from an instantaneous snapshot. Preserve unknown and invalid values with reasons.
- Slurm: accept actual booleans or an explicitly documented source encoding; reject ambiguous permission values. Missing deadline, GPU count, runtime, pause permission and power remain unknown until reviewed. Separate scheduler time limit, observed elapsed time and predicted remaining runtime. Defaults can be labelled for a synthetic preview only.
- DCGM: pin the supported collector/version and metric names. Handle timestamped exposition, unsupported/sentinel values, device/MIG identity and duplicates explicitly. Preserve scrape time versus sample time. Do not equate GPU utilisation with facility power or claim board/device metrics cover the facility.
- Use source-record IDs, source hashes and transformation versions consistently. Browser preview does not establish a qualified observation artifact.

### Canonical Engine quality

Change `data_center/telemetry_quality.py`, `observations.py`, `measurement_boundaries.py`, `data_readiness.py` and `application/shadow.py`.

1. Validate finite nonnegative energy aggregates; validate finite thresholds and meaningful ranges; reject NaN/Infinity before arithmetic. Reuse `assess_energy_balance` instead of independent arithmetic.
2. Require a strictly increasing unique reference axis, expected measurement IDs, expected period and planning/evaluation cutoff. Add source cadence/sample-kind metadata where needed. Reuse `align_observations`; compute missing coverage from the expected matrix, not only explicit missing rows.
3. Specify revision policy: exact duplicates, conflicting same-sequence rows and later revisions must have deterministic outcomes. Exclude future-available observations and report exclusions without silently claiming complete evidence.
4. Avoid comparing every observation with every reference instant. Use indexed instants or bounded nearest-time search with a documented tolerance; retain original event times and resampling evidence.
5. Validate readiness entries and required IDs. Authoritative status requires a resolved, hash-verified manifest, valid measurement boundaries, quality acceptance and recorded provenance review. Keep software-shadow readiness separate from measured qualification and commercial enrolment. Rename or supplement `dependable_claim_ready` so it cannot imply more than these checks establish.
6. Make raw observations the source of energy aggregation where metering boundaries permit. If supplied/consumed totals are external summaries, retain their origin and reconciliation status; they must not be unverified independent values that happen to match.

API changes: strict new quality fields and finite-number validators in `api/models.py`; version a changed shadow contract rather than silently requiring new fields in v1. Keep old requests conservatively labelled as incomplete/legacy. No schema migration is necessary for an offline-first implementation.

Tests: null versus zero; string-false permissions; absent deadline; duplicate device IDs; counter reset; nonfinite energy/thresholds; negative energy; duplicate/unsorted instants; absent channel; sparse channel; post-cutoff revision; mixed units/sample kinds; authoritative-without-manifest; tampered evidence. Verify both direct Engine calls and HTTP validation.

Gate: F01-F05 regressions fail before fixes and pass after; no malformed or incomplete evidence produces a measured-ready result. Unknown readings never become zeros or permissions.

## 7 Phase 2 Develop the ten-report editorial corpus

Reuse `operational-knowledge.ts`; split records and retrieval into adjacent modules only as size warrants. Do not ship the local skill directory or entire PDFs with customer prompts.

Proposed record contract:

`id, revision, title, summary, sourceId, sourceUrl, sourceContentHash, physicalPdfPages, printedSection, publicationDate, reviewedAt, reviewer, reviewStatus, applicability, excludedUses, topics, aliases, requiredInputs, supportedActionIds, supersedes`.

Existing response DTO stays bounded: return only fields needed to understand the answer; keep the full editorial manifest server-side. Distinguish editorial review from independent domain approval. If the reviewer is an application developer, label that accurately.

Report coverage tasks:

| Source | Records to write/review | Product use | Exclusions |
|---|---|---|---|
| B05 | Capacity/duration/response, tenant/SLA authority, UPS versus BESS, opportunity cost, recovery | Flexibility investigation and readiness | No default site MW, revenue or service qualification |
| A03 | Workload-specific useful work, hardware/configuration boundaries, operating points | Calibration and efficiency explanation | No rating-based measured power |
| B04 | DTC/immersion/rear-door, LTA/LTL rejection, residual fans/pumps, PUE limitations, reuse prerequisites | Cooling evidence checklist and comparison | No transferred AI savings; no rack safety claim |
| A02 | Model boundaries, utilisation assumptions, uncertainty and comparability | Scenario assumptions and evidence labels | No sector projection as site load |
| A04 | Scenario accounting and sensitivity framing | Assumption organisation | No new dispatch model |
| A01 | Case-specific baselines, activation and M&V requirements | Event evidence checklist | Reverify current market requirements |
| B02 | Signal/instruction/device layers, interoperability limitations | Connector design | Residential protocol review is not data-centre certification |
| B01 | Aggregator/platform roles and practical barriers | Participation-readiness guidance | No marketplace or revenue forecast |
| A05 | Infrastructure versus IT efficiency and label boundaries | Reporting explanation | No certification assertion |
| B03 | Service-preserving measurement lesson | Editorial methodology only | No display curves or unrelated product module |

Every record must be checked against its physical PDF pages. Starting reviewed locations include B05 physical pp. 10, 17, 25-26; B04 pp. 4, 28-29; A03 p. 8; B02 pp. 6 and 9; A05 p. 2. Other proposed records require page verification before approval. B04 Table 4 arithmetic remains excluded pending reconciliation; keep that source limitation attached to quantitative uses.

Retrieval implementation:

1. Normalise case/Unicode, tokenize aliases, match phrases across token spans and add reviewed EN/DE synonyms. Do not use unrestricted prefix stemming for legal applicability.
2. Score exact topics/phrases and current intent above generic words. Filter by purpose, facility/workload context and excluded uses before ranking.
3. Return up to four short findings plus an explicit coverage/gap status. No match means no supported guidance, not an invented reference. Do not append interpretation labels such as `knowledge` as if they were user subject matter.
4. Keep deterministic tie-breaking and a versioned corpus fingerprint. Record retrieved record IDs/revisions in receipts/exports without raw private prompts.
5. Add at least 30 independently labelled retrieval questions: synonym/phrase, German, unknown topic, conflicting applicability, negative use, and compound questions. Include expected relevant and forbidden records. This is a proposed acceptance set, not completed evaluation.

Gate: every emitted report claim has valid pages, applicability and allowed use; no report provides site calibration or dispatch evidence. Qualitative guidance can be retrieved without creating a plan only if a separate product decision explicitly adds that experience; current selected-plan admission remains unchanged for this release.

## 8 Phase 3 Structured checked answers and evidence navigation

Files: `verified-claims.ts`, `conversation-contracts.ts`, `conversation-query.ts`, `analysis-plan.ts`, `copilot-composition.ts`, `copilot-handler.ts`, `conversation-presentation.ts`, `PlanConversation.tsx`, `CopilotEvidence.tsx`, `contracts.ts`, `brief.ts`, `use-plan-copilot.ts`.

Add an optional negotiated `findings` representation rather than replacing v2 blocks immediately:

`id, kind (answer/evidence/guidance/limitation/next_action), checkedText, factIds, guidanceRefs, mandatory, severity, navigation, actionId`.

Requirements:

- IDs derive from stable executor concepts and scope, not array position. A fact reference includes the selected assessment identity; guidance references include record revision/corpus identity.
- Meta selects eligible IDs/order only. Canonical code owns text and numerical comparisons. Mandatory failed/unavailable checks remain visible regardless of model selection.
- A short direct answer appears first; supporting findings can collapse. Relevant limitations stay adjacent and mandatory warnings remain expanded. Do not hide all limitations behind a generic disclaimer.
- Preserve typed fact/guidance links through reordering. Either regenerate valid `paragraphSources` from structured findings or supersede it with the negotiated findings contract. Do not fabricate links by parsing prose.
- Fix F08 with one renderer: text is suppressed only when an equivalent fact card is actually rendered. Component tests cover composed/fallback/legacy modes.
- `CopilotEvidence` gets a typed inspect action to the existing view, timestamp/range and workload. A source anchor for a report may link to the public source/PDF page where available; do not expose local skill filesystem paths in the website.
- Review provider labels: say the model interpreted/prioritised checked findings; do not imply it independently verified the calculation.
- Define a deterministic fast path for questions needing no model prioritisation. Preserve interpretation if needed and record skipped stages truthfully. Select this policy from measured answer quality/latency, not a universal assumption that extra model calls improve answers.

Versioning: use a new explicit capability value for structured findings; keep old-client checked blocks until compatibility tests permit retirement. Extend receipts with corpus/version and semantic acceptance status separately from HTTP outcome.

Gate: unknown/duplicate IDs rejected; no warning lost; every displayed finding navigates to the correct assessment; old clients work; keyboard/mobile evidence inspection passes.

## 9 Phase 4 Scoped investigation and comparison

Files: `analysis-plan.ts`, `experiment-proposal.ts`, `AlternativePlanReview.tsx`, `AccountingReview.tsx`, `use-plan-conversation.ts`, `use-milp-calculation.ts`, `experiment-lifecycle.ts`, `copilot-capabilities.ts`, `copilot-handler.ts`, analytics contracts/client and brief export.

Replace static diagnosis lists with deterministic investigation recipes keyed to question intent, asset and evidence availability. Each gap has `id, scope, status, requiredEvidenceIds, reason, permittedActionId`; use only explicit statuses such as unknown, missing, supplied, quality_failed and reviewed. Do not display a global percentage readiness score.

First recipes:

1. Battery not discharging: inspect accepted dispatch/SOC/reserve/availability and diagnostic findings; offer existing power/energy/availability alternatives. Label untested explanations as hypotheses. Counterfactual improvement is not proof of the original solver's unique causal preference.
2. Workload delay: inspect exact workload deadlines, pause/restart permissions and remaining work. Preserve protected services and distinguish baseline execution from earliest permitted start.
3. Flexibility offer: show baseline, MW, duration, response evidence resolution, availability, recovery and permission gaps. Never turn feasible planning into an enrolled offer.
4. Cost: unchanged schedule goes to Python accounting under a reviewed tariff; cheaper dispatch requires a supported new objective/solve. Do not derive a retail bill from wholesale prices.
5. Cooling: identify topology and measurements first; offer existing cooling-load sensitivity as an assumed scenario only.

Compile approved action IDs into existing reviewed proposal controls. The model cannot submit jobs, choose arbitrary endpoints, add fields or alter reserve/SLA policy invisibly. Each submit requires exact old/new values, units, preserved assumptions and baseline fingerprint.

Unify comparison representation around baseline/job/case/mode/result identity and typed deltas for peak, target exceedance, completed work, deadlines, reserve, terminal state, recovery and accounting. Fullb calculates numeric deltas when new accounting is needed; Product may render already qualified values. Distinguish unavailable, invalid, infeasible, failed replay and accepted results.

Fix attachment race F14: lifecycle identity includes attachment identity/revision, or changes cancel pending work and clear affected context; accept response only against the exact submitted baseline and attachment. Conversation/request/brief invalidation must follow the same rule. Failed/unknown submission recovery never resubmits automatically.

Exports include action assumptions, comparison identities, guidance revisions and unresolved gaps. Compute a review digest over all included evidence/attachments; changing any included artifact clears acknowledgement. Keep acknowledgement distinct from operational approval.

Gate: baseline immutable; no accidental duplicate POST; ownership enforced server-side; late results cannot cross baseline/attachment changes; failed case visible; reviewed JSON round-trip retains all provenance.

## 10 Phase 5 Independent evaluation and user validation

Extend `evaluation.ts`, `scripts/qualify-copilot-conversation.ts` and existing fixtures/tests. Do not build a parallel evaluation service.

Create a versioned case file with `caseId, domain, question, context, expectedIntents, requiredFactIds, requiredGuidanceIds, forbiddenClaims, expectedCoverage, expectedActionOrGap, severity, reviewer, fixtureIdentity`. Separate development cases from a held-out set. Retain all failed runs and source/model/corpus identities.

Proposed set: 60-100 distinct cases across battery, workloads, cooling, usable flexibility, uncertainty, accounting, reporting and integrations. Include ambiguous assets/timezones, false premises, mixed questions, unsupported model changes, prompt injection, unavailable site evidence, stale plans, sparse telemetry and conflicting report applicability. Repeating 42 cases three times remains 42 unique cases; report repetitions separately.

Scoring layers:

1. Deterministic schema/ownership/identity/units and evidence lineage.
2. Required coverage and forbidden claims using structured expectations; substring checks remain regression helpers, not semantic accuracy certification.
3. Independent expert rubric: correctness, missing warnings, applicability, useful next action and readability. Record disagreements and adjudication. Do not train on held-out answers.
4. Actual model attribution, semantic rejection/fallback, p50/p95 latency, known/unknown usage and estimated cost. Model-as-judge is optional advisory evidence, not the sole gate.

Proposed release gates: zero critical unsupported numerical/operational claims; every mandatory warning retained; every expected refusal/gap correctly represented; all identity/ownership regressions pass; at least 90% fully correct task coverage on the held-out set after rubric agreement. The percentage is a proposed target, not current measured performance. Critical failures block even if average scores pass.

Conduct a small formative study with 3-5 energy managers/engineers using the same tasks with and without the copilot. Measure task completion, errors, elapsed time and confidence calibration. This is usability evidence, not a statistically representative savings claim.

## 11 Phase 6 Read-only evidence intake and calibration review

Reuse Fullb `adapters/capture.py`, `adapters/component.py`, `adapters/workload.py`, `data_center/observations.py`, `measurement_boundaries.py`, `artifacts.py`, `profile_calibration.py`, `calibration_registry.py` and `application/calibration.py`.

Start with a bounded offline JSON/CSV package and local review output. Upload/storage in the product is conditional on an explicit retention/access design; no new Supabase tables are required for the initial offline deliverable.

Intake manifest: dataset/facility/source identities, owner permission, licence/use scope, content hashes, capture time, event/available/ingested times, units/sample kinds, measurement boundaries, device configuration, meter/calibration metadata, timezone and transformations. Pseudonymise tenant/execution identities where possible. Raw operational captures remain private and excluded from public snapshots.

Pipeline: validate -> preview excluded rows -> align using predeclared cutoff -> reconcile energy boundaries -> quality report -> chronological identity-disjoint split -> fit on training only -> validation/test evaluation -> immutable candidate -> human review -> approved artifact release. Serving does not train or promote models.

Workload metrics include useful completed work, elapsed time, deadline performance, checkpoint/restart overhead, hardware/GPU count/model/power cap and configuration. Compare like workloads and service quality; do not use a low-power configuration that simply fails the required work as an efficiency win.

Calibration policy: retain existing conservative model unless the candidate satisfies reviewed error and operating-range thresholds. Existing minimum row counts are software checks, not adequate evidence of field representativeness. Define workload-specific sample coverage before collection. Test out-of-range rejection, configuration drift, rollback and held-out leakage.

Product later adds an evidence-readiness view showing missing/failed/accepted prerequisites and downloadable quality report. Do not represent successful file parsing as calibration or measured delivery.

Gate: authorised data, complete provenance and independent held-out review; otherwise deliver the tooling and leave measured qualification blocked explicitly.

## 12 Phase 7 Repeated events, uncertainty and response qualification

Reuse Fullb `application/rolling.py`, `data_center/rolling_planner.py`, `application/uncertainty.py`, `data_center/uncertainty.py`, `common_plan.py`, battery/thermal/workload replay, `delivery_assessment.py` and `market/eligibility.py`.

1. Keep independent-window benchmarks explicitly distinct from chronological state-carrying replay. The existing rolling result already says `independent_window_benchmark_not_stateful_control`; preserve it.
2. Build bounded repeated-event fixtures carrying SOC, battery mode/dwell/fatigue, thermal debt/temperature, checkpoint/restart state, remaining workload and deadline ageing. Future information must not leak into the prior decision. Include a feasible first event followed by failed recovery/second event.
3. Make horizon limits explicit. Existing bounded thermal replay and shadow window limits do not establish multi-day support. Extend only the necessary application budget/state handoff, with tests and measured runtime; no silent large-horizon solver expansion.
4. Fix F11 by declaring `evaluation_method` in strict API contracts and schemas. Existing independent-scenario results remain hindsight/scenario benchmarks. Common-command feasibility is a distinct result class, and neither assumed probabilities nor a confidence input establish empirical reliability.
5. Narrow scenario bounds/windows DTOs; use scenario count, horizon, workload/assets and total solve budget together. A maximum of 1,000 scenarios is not evidence that such a request is operationally affordable. Add cancellation/deadline tests through existing job execution; do not create another worker/runtime or resume PR #37.
6. Add timing provenance/resolution to response assessment. Interval models can report interval-level delivery; seconds-level qualification requires timestamped activation/response measurements or validated dynamic evidence at adequate resolution. Market eligibility must check this evidence instead of a declared requirement alone.
7. Harden delivery inputs: nonempty event mask, finite aligned trajectories, valid requested reduction/tolerances, actual hex hashes and verified baseline chronology. Report delivery, rebound, battery/thermal/workload recovery and SLA outcomes separately.
8. Market qualification remains technical screening. Commercial enrolment, contracts and settlement evidence are separate states. No automatic offer or command.

Product exposure is private and feature-gated after genuine Engine/API round-trip qualification. Add typed uncertainty/rolling result schemas and comparison cards only for the qualified subset, not the entire research inventory.

Gate: one shared state trajectory survives every event boundary; failed recovery is visible; no fast-service qualification from coarse samples; no measured reliability label from assumed scenario weights.

## 13 Phase 8 Cooling configuration and evidence

Extend existing `CoolingCalibration` and optional `ThermalEnvelope`; do not duplicate them. Store topology separately from heat-rejection path: air, direct-to-chip, immersion/hybrid plus liquid-to-air versus liquid-to-liquid where applicable. Record pumps/fans/heat rejection and remaining air-cooled load so components are not double counted.

Calibrate aggregate electrical behaviour with measured IT/cooling power and ambient conditions. Qualify the optional single-zone thermal replay separately; it is not a rack/coolant/OEM safety model. Define measured operating ranges and reject extrapolation. Add piecewise terms only if residual analysis shows the current model is inadequate and evidence supports them.

Report IT energy, cooling energy, total energy, useful work and service outcomes together. PUE remains a boundary-dependent reference. Heat reuse requires temperature/flow/offtake/seasonality/pumping/heat-pump evidence; keep unavailable items explicit.

Files: Fullb `data_center/calibration.py`, `facility.py`, `phase2/thermal_workload.py`, `application/calibration.py`, existing approved artifact loader; Product analytics schemas, canonical presentation, evidence cards and guidance records. Any new result units (temperature, flow, water) require explicit typed contracts and formatters, not generic strings in the current MW/MWh fact schema.

Gate: no report savings become model parameters; no rack-safety claim; calibrated range and version appear in every applicable comparison. Data-dependent fitting waits for authorised captures.

## 14 Phase 9 Meta operational controls

Files: `src/server/operations/copilot.ts`, `copilot-handler.ts`, `copilot-policy.ts`, `copilot-composition.ts`, receipts/evaluation, `wrangler.jsonc`, generated bindings, existing deployment configuration and tests.

Immediate code-only work:

- Build minimal stage inputs; avoid sending unnecessary tenant names, raw captures or full transcripts. Keep Standard allowlist and server-only keys. Retain `store:false` without claiming it proves ZDR.
- Separate HTTP receipt outcome from parsed/schema/verified acceptance; include stage reason codes without raw prompt logging. Preserve usage from attempts even when an answer is rejected.
- Pin prompt/corpus/schema/model policy versions; keep a reviewable update path for model changes. Unknown or deprecated models fail configuration validation.
- Classify request purpose/data class explicitly. Missing trusted country metadata is currently allowed; decide an explicit production policy for private-data calls and test local/deployed behaviour rather than silently changing all clients.
- Measure end-to-end deadline across interpretation and prioritisation, not only per-call timeouts. Reserve response time for verified deterministic fallback and show it honestly.
- Consider stable-prefix ordering/caching only after checking current Meta support, data policy and actual cache-hit reporting. Do not promise savings from documentation alone.

Budget design, conditional on approved shared storage/runtime configuration:

1. Before each paid stage, atomically reserve a conservative token/cost ceiling against a per-account/team/time-window budget using a versioned pricing policy and model output bound.
2. Use request IDs to prevent duplicate reservations; concurrent Worker instances share one authoritative ledger. An in-memory per-instance counter is insufficient.
3. Reconcile known usage. An uncertain provider outcome keeps a conservative reservation until controlled reconciliation; do not release everything simply because the browser disconnected.
4. Admit no new paid work when the ledger is unavailable or exhausted; offer checked deterministic content where supported. Report budget-exhausted separately from provider-outage.
5. Test concurrency, retries, rollover, partial/unknown usage and ledger failure. No account secrets in logs or exports. Do not change billing or provision storage as part of a code-only task.

Account review: verify actual account/team, model mode, contract and retention settings before private operational data. Meta states that ZDR is separately enabled and spend alerts are not hard caps. Current sources are listed in section 18. Their documentation is not evidence of this account's settings.

Gate: no cross-provider fallback hidden from user, no fabricated complete cost ledger, and no organisation-wide hard-cap claim until the shared admission mechanism and account policy are verified.

## 15 Phase 10 Selected read-only integrations

Choose one pilot source from actual partner requirements: DCGM plus scheduler history, or PCC/BESS telemetry. Begin with exported captures using the same typed intake; add network polling only after credentials/network/retention ownership is agreed.

For a later signal adapter, preserve issuer, site/PCC, event identity, revision/cancellation, issued/available/valid times, units/sign, baseline, priority, acknowledgement and source hash. Separate price/carbon reference signals from service requests and device commands. Pin the authoritative protocol schema/version; a PDF mentioning a protocol does not qualify an implementation.

Connector status must show last observation, freshness, data quality, permissions and supported measurements. A successful connection alone is not operational readiness. Stale signals and conflicting revisions fail closed at analysis admission. No write endpoints or device control transport belong to this release.

Extend existing Product connectors and Fullb adapters; do not build a generic integration marketplace. Test recorded fixtures, clock drift, auth expiry, schema drift and cancellation. A network connector that can fetch arbitrary user-supplied URLs requires explicit SSRF/credential-boundary review; prefer configured allowlisted sources.

## 16 Implementation change sets

| Change set | Repository | Content | Dependency and review focus |
|---|---|---|---|
| CS01 | Product | Connector null/permission fixes, explicit import assumptions | Independent; inspect every existing connector consumer |
| CS02 | Fullb | Telemetry/alignment/readiness finite/completeness/provenance fixes | Before measured/pilot exposure |
| CS03 | Product API | Versioned quality DTO/Engine compatibility and canonical integration tests | CS02 wheel and manifest |
| CS04 | Product | Report schema/content, phrase/topic retrieval and retrieval cases | No new backend infrastructure |
| CS05 | Product | Negotiated structured findings, renderer fix, evidence navigation | CS04; preserve legacy claims protocol |
| CS06 | Product | Scoped investigations, comparison/review digest, attachment race | CS05 and existing exact experiments |
| CS07 | Both | Held-out domain cases, review rubric, source/result fixtures | Starts before changes; gates every release |
| CS08 | Fullb then Product | Offline intake/calibration review and evidence-readiness UI | CS02/03; actual data separately supplied |
| CS09 | Fullb then Product | Bounded stateful repeated events, timing provenance, uncertainty method DTO | Qualified CS08 inputs for measured claims |
| CS10 | Fullb then Product | Cooling topology/calibration and typed presentation | Actual cooling evidence |
| CS11 | Product | Meta data minimisation, semantic receipts, deadlines and fast-path policy | CS07 quality comparisons |
| CS12 | Product/infrastructure | Shared budget reservations and chosen read-only connector | Separate storage/network/account approval |

Use focused merge commits with qualified artifacts and normal history. Do not combine physical-model changes, UI redesign and infrastructure provisioning into one unreviewable release. For Engine changes, qualify the exact wheel with Product API before enabling consumer UI.

The first useful release is CS01-CS07 plus code-only CS11. It improves trust and investigation without waiting for site data. Measured calibration, cooling fitting, partner connectors and commercial validation are later milestones with external prerequisites; completion of software tasks does not satisfy them.

## 17 Phase 11 Validation and release protocol

No broad suite is needed merely to save this plan. During implementation:

1. Check RAM and existing development/test processes. Use the managed validation lock; do not overlap local jobs across worktrees/chats. Respect 3 GB start and watchdog policies, two unit workers and one browser worker.
2. Run narrow tests for each changed boundary. Product commands use `npm run verify:local -- unit <target>` and `npm run verify:local -- checks`; run fast browser batch before owned Operations specs. Use `scripts/e2e-manifest.mjs` as the sole browser ownership list.
3. Engine tests start with affected existing files: `test_adapter_safety_telemetry_quality.py`, `test_data_center_measurements_observations.py`, `test_data_center_pilot_readiness.py`, `test_workload_adapter_calibration.py`, `test_calibration_pipeline.py`, `test_application_shadow.py`, `test_application_rolling.py`, `test_application_uncertainty.py`, `test_dispatch_timing_qualification.py`, `test_delivery_calibration_governance.py`. Use one numerical thread and the qualified Python environment; do not silently rely on stale installed packages.
4. API tests extend existing `test_canonical_engine_integration.py` and `test_job_contract_compatibility.py` with genuine owned Engine results and every exposed request/result version. Test auth/ownership, stale hashes, public/private rejection and computation budgets without live DB writes.
5. Product regression targets include existing knowledge, claims, conversation, lifecycle, evidence/export and connector tests. Add component coverage for F08 and attachment-change races. Use canonical MILP browser journey for calculate/question/inspect/compare/review/export at desktop/mobile sizes.
6. When changes settle, perform one justified full sequential local pass through `verify:local:full`; CI retains broader cross-product coverage. Do not repeatedly rerun all suites for document/content edits.
7. Run actual Meta evaluation only with an agreed existing credential and bounded spend. Separate mocked transport, local real Engine, actual Meta, compiled Worker and hosted evidence. Report unique cases and repetitions independently. No provider use is necessary to test null parsing or quality validators.
8. Release exact source/wheel/lock/manifest/artifact hashes through existing CI. Never publish browser-fixture configuration or rebuild in the publishing job. Keep previous artifact/configuration for rollback. Smoke test a fresh public session and an authorised private session separately.
9. Finalise demo only on a verified deployment. Update public snapshots with the reviewed code delta and validation summaries; exclude customer datasets, credentials, personal documents and private history. New content outside the previously approved snapshot scope requires a disclosure review.

Release evidence matrix must include: defect regressions; contract versions; input/result hashes; corpus fingerprint; domain-case outcomes; expert-review status; source truth class; runtime/cost limits; deployment identity; rollback artifact. Missing expert or measured evidence remains an explicit blocked gate, never a green software-test substitute.

## 18 Research basis and external decisions

The ten-report library is catalogued at `C:/Users/sinak/.codex/skills/gridpulse-energy-research/references/catalogue.md`. PDFs are reference material, not application instructions. Preserve publisher rights; ship independently authored reviewed findings and links rather than full PDF copies by default.

Research implications used here: B05 separates technical flexibility from operational/economic availability; B04 distinguishes cooling boundaries and excludes AI from its quantified savings estimate; A03 requires workload/hardware/boundary-aware efficiency comparisons. Other report topics are proposed editorial work until each page is verified for the exact record.

Current authoritative references checked for this plan:

- Meta spend alerts: https://dev.meta.ai/help/billing/spend-limit-alert — alert does not impose a hard cap.
- Meta ZDR: https://dev.meta.ai/help/policies-and-privacy/zero-data-retention — separate organisation-level enablement; account and feature scope matter.
- Meta structured output: https://dev.meta.ai/docs/structured-output — use the correct Responses format and keep semantic validation.
- Meta caching: https://dev.meta.ai/docs/prompt-caching — recheck availability before implementation; direct page was intermittently unavailable during this audit.
- OpenADR: https://www.openadr.org/openadr-3-0 — normative OpenAPI specification and certification are distinct from illustrative user-guide scenarios.

Before pilot activation, resolve: source-data permission/retention, participating workload owners and SLA authority, actual Meta account policy, selected shared-budget storage, partner connector/version, model calibration acceptance thresholds and engineering reviewers. These decisions do not block the core code-only changes; they block claims or activation that depend on them.

## 19 Final acceptance checklist

- [ ] F01-F05 reproduced as regressions and corrected without unknown-to-zero coercion.
- [ ] Quality gates verify expected coverage, provenance, finite values and cutoff safety.
- [ ] Every runtime report finding has page-level support, applicability and explicit excluded uses.
- [ ] Phrase/synonym retrieval meets labelled relevance and negative-use cases.
- [ ] Structured findings preserve mandatory warnings and per-finding evidence after ordering.
- [ ] Composed/legacy/fallback renderers retain every required fact; source inspection navigates correctly.
- [ ] Investigations are asset/question-specific and cannot submit unreviewed jobs.
- [ ] Baseline/experiment identity and review digest invalidate stale answers and exports.
- [ ] Held-out evaluation and independent review are reported separately from schema/test success.
- [ ] Read-only intake/calibration tooling preserves private data and held-out boundaries.
- [ ] Repeated-event and uncertainty results retain state, method, resolution and evidence limitations.
- [ ] Cooling parameters are measured/reviewed or clearly assumed; no transferred report savings.
- [ ] Meta stage acceptance, latency, usage and budget admission are truthful.
- [ ] No market enrolment, measured reliability, fast-response qualification or physical authority is inferred from a plan.
- [ ] Exact paired artifacts pass CI and separate public/private smoke tests before deployment claims.
- [ ] Public snapshots and demo identify actual qualified changes and exclude private evidence.

