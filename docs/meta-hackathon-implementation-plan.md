# GridPulse Meta hackathon implementation plan

Prepared for Sina Khedmati on 28 October 2026. Status: proposed implementation; no product changes or deployment are included in this document.

Build one complete investigation workflow around the existing product: ask about an accepted plan, inspect checked evidence, review a proposed change, run a separate calculation, compare outcomes, and export a reviewable explanation. Meta interprets and selects; the existing engine owns quantities and physical acceptance. The first work fixes semantic grounding and experiment lifecycle defects. New modalities follow only after the core workflow qualifies.

## 1 Scope and starting evidence

### Repository ownership

Paths below are relative to these roots:

| Name | Local root | Responsibility |
| --- | --- | --- |
| Product | `C:/Users/sinak/OneDrive/Desktop/Developing Applications/GridPulse-Full` | React UI, Worker routes, copilot orchestration, shared TypeScript contracts, Python API source and release workflows |
| Engine | `C:/Users/sinak/OneDrive/Desktop/Developing Applications/GridPulse-Fullb` | Canonical optimisation, physical replay, experiments, accounting, calibration and backtesting |
| Pinned API | Engine `.render-core` submodule | Pinned checkout of the Product repository used for engine/API qualification; not a third independent implementation |

Inspected Product commit: `cbec796246308dee315cee788b9e8756eaf46fd6`. Inspected Engine commit: `ae332199868caad4eb9ffa3e38cc427e87e05de3`. Pinned API checkout: `97c5646` abbreviated. Capture full SHAs again before implementation. These are local inspection identities, not a new assertion about the latest remote deployments.

Product was clean before this plan. Engine contains existing untracked `output/`, `reports/tests/` and `tmp/`; preserve them. Start future Product development from refreshed production `origin/main`, using a `codex/` branch. Record differences between the live product, engine release and pinned API before updating any pointer.

### Verified findings and their strength

| ID | Finding | Evidence and consequence |
| --- | --- | --- |
| F1 | Conversational prose can contradict its cited facts | The previous audit executed `renderGroundedDraft` with 60 minutes above target and the text “Grid import never exceeds the operating target.” It accepted the paragraph. This is a constructed validator probe, not an observed live-model answer. |
| F2 | First exact experiment appears blocked by a normal-plan snapshot precondition | `use-milp-calculation.ts` skips snapshot creation when `experimentRequest` exists, then requires `snapshot.current` before calling `startFacilityExperiment`. `AlternativePlanReview` creates a fresh hook. This is a source-level control-flow finding; reproduce with a focused hook/component test before fixing. |
| F3 | Public and private capabilities differ intentionally | `AlternativePlanReview`, `AccountingReview`, `analytics-api.ts` and server capability flags preserve private exact experiments/accounting. Public alternatives rebuild a synthetic scenario; they are not exact-baseline experiments. |
| F4 | Generation receipts lose stage detail | The transport records provider names, while the handler deduplicates attempts and reports the last provider. Interpretation and composition can use different providers; one label cannot describe that reliably. |
| F5 | Live evaluation mostly checks routing and output shape | `qualify-copilot-conversation.ts` checks intents, kind, focus, investigation shape and presentation. In conversational mode, its `requiredText` assertion is bypassed. That is not a semantic correctness gate. |
| F6 | API deduplication already exists | `JobSubmission.create` hashes payloads; the in-memory store locks creation and the Supabase store uses existing creation RPCs. Verify atomicity and scope before extending anything. Do not build another job service. |
| F7 | Physical and evidence boundaries are already substantial | Engine solver support distinguishes limit reached from infeasible, checks incumbents, and routes through physical acceptance. Replay, calibration and uncertainty have versioned application boundaries. Reuse these. |
| F8 | Some research release gates fail | Engine `reports/backtest-report.md` fails ranking/bands; `reports/live-upstream-backtest.md` fails the alert gate. Neither is a site-flexibility validation. Keep claims blocked. |

### Scope boundaries

- Preserve PR #38 calculation corrections and the production live-control evidence wording.
- Parked PR #37 remains excluded. No PR #37-only migrations, workspace readers, worker/runtime additions or release are part of this plan. If a proposed demo depends on those changes, choose an already supported path or record the dependency as blocked.
- No Supabase schema, data, billing or production activation changes are implied by implementing UI or copilot work.
- Do not add a second optimiser, generic autonomous agent, model training pipeline, vector database or physical control connector.
- Do not convert failed research gates to passing by changing labels or hiding cases.

## 2 Target product behaviour

The demonstration question is: “If the import limit falls to 95 MW, can the submitted workloads still finish while protecting the battery reserve?” The exact value is a synthetic scenario input, not a claim about a real site.

The application must:

1. Show an accepted baseline and its identity, assumptions, model status and evidence class.
2. Use Meta to interpret the question into existing bounded queries and a proposal.
3. Resolve relative values and asset IDs in application code against the owned baseline.
4. Display exact before/after inputs and preserved restrictions; require user confirmation.
5. Submit to the existing job API. Show queued/running/failed/accepted states truthfully.
6. Compare the accepted baseline with the returned experiment; distinguish fixed-plan stress from re-optimisation.
7. Explain verified findings, missing evidence and next review actions without inventing quantities or causes.
8. Export a brief with calculation lineage, generation receipt and review acknowledgement.

An infeasible alternative is a valid investigation outcome. Its failure must not replace the accepted baseline or become a fabricated successful schedule.

## 3 Phase 0 Prepare the candidate and resolve event requirements

Dependencies: none. Estimate: half a day including access checks; external responses may take longer.

### Tasks

1. Refresh both remotes read-only, inspect status and compare release identities. Do not switch over or discard dirty work.
2. Record the Product, Engine and pinned API full SHAs, model ID, prompt/contract versions, build artifact hash and existing deployment identifiers in a candidate manifest. Proposed new file: `docs/meta-hackathon-candidate.example.json`, containing placeholders only; actual run manifests belong in ignored output or CI artifacts.
3. Retrieve the accepted participant rules and submission form from the signed-in event portal. Record existing-project eligibility, build-period requirements, track, team rules, repository-access requirements, video length, licences, judging criteria and deadline. Public event marketing does not resolve these details.
4. Inventory what existed before 26 October and what the hackathon adds. Use commits and feature evidence; do not present pre-existing work as entirely new.
5. Verify the intended Meta account has Standard access and credits. Inspect only configuration names/status, never print keys. Do not install Muse Code or create a new credential merely to perform this audit.
6. Choose the delivery path: existing public synthetic experience, plus an already qualified private session for exact experiments if available. Do not bypass public admission or create an unreviewed shared login.

### Gate

Candidate identities and remaining event requirements are explicit. Independent fixes may continue while event details are pending; submission-specific claims remain conditional. No production settings change at this phase.

## 4 Phase 1 Make consequential claims deterministic

Dependencies: Phase 0 source baseline. Priority: P0. Estimate: 1 to 1.5 days.

### Files to adapt

Product:

- `src/server/operations/copilot-composition.ts`
- `src/server/operations/copilot-conversation.ts`
- `src/server/operations/copilot-handler.ts`
- `src/features/operations/copilot/conversation-query.ts`
- `src/features/operations/copilot/analysis-plan.ts`
- `src/features/operations/copilot/brief.ts`
- `src/features/operations/copilot/contracts.ts`
- `src/features/operations/copilot/conversation-contracts.ts`

Proposed small modules: `src/features/operations/copilot/verified-claims.ts` and `verified-claims.test.ts`. These hold the claim registry and deterministic rendering, not another calculation engine.

### Implementation

1. First add regression tests for F1 and related false claims: target exceeded, incomplete workload, reserve failure, unavailable deadline, unproven optimality and missing measured data.
2. Reuse `eligibleBriefClaims` as the design precedent. Create eligible conversational claims from existing selectors and checked facts. Represent a claim as an ID, topic, scope, truth state (`supported`, `contradicted`, `unknown`, `not_applicable`), fact IDs and deterministic text. Only supported findings and explicit unknown/failed-state findings are selectable.
3. Define separate conditions for facility import limit, operating target, protected battery reserve, terminal target, workload completion, deadline evidence and solver status. Do not merge these into a generic “safe” flag.
4. Reuse full-precision engine/selector outcomes and established tolerances. Do not derive success from rounded display values or translate a missing value to zero. When a selector does not supply a qualified outcome, return unknown rather than invent a frontend physics calculation.
5. Replace the writer's arbitrary paragraph text for consequential statements with a structured selection such as `{sections:[{findingIds:[...], guidanceIds:[...], nextActionId:...}]}`. The model selects relevance and order; code renders the actual conclusion. Enforce eligible IDs with both provider schema enums and server validation.
6. Preserve mandatory failed/unavailable checks and the essential model boundary even if the model omits them. Limit paragraph/section counts and references as today.
7. Keep definitions and reviewed guidance as separately labelled, reviewed text. Do not leave a free prose field next to verified claims that can reverse their meaning. A second model critic may assist evaluation later, but cannot be the only release gate.
8. Retain the checked deterministic answer on malformed selection, timeout or provider failure. Preserve the successful interpretation receipt if composition fails. Record a non-sensitive fallback reason code rather than swallowing all failures without classification.
9. Keep numeric insertion, source links and existing navigation. Reject IDs from another workload, query, experiment or result. For multi-query answers, preserve existing namespacing of `job.*` evidence.
10. Introduce a new prompt version for claim selection. If the response representation changes incompatibly, version the conversation contract and update handler/client/tests together. Support the previous request version with a checked deterministic response during a bounded rollout, or explicitly refresh stale clients; do not silently reinterpret old schemas.

### Required tests

- The F1 contradiction is impossible to select or display; 60 minutes above target produces an above-target finding.
- A zero breach metric supports only the metric's actual limit, horizon and scope.
- Unknown and not-applicable outcomes remain distinct.
- All-complete cannot be emitted with unfinished work; complete work does not imply every deadline is known.
- Reserve protection does not imply outage autonomy or equipment approval.
- Solver timeout with a feasible incumbent remains feasible, not proven optimal.
- Wrong IDs, omitted mandatory warnings, duplicate selections and budget overflow fail closed.
- Provider failure leaves the accepted calculation and checked answer usable.

Exit gate: the adversarial claim suite passes and every consequential displayed conclusion comes from a tested renderer. No Engine change is expected for this phase.

## 5 Phase 2 Repair experiment submission and preserve lifecycle identity

Dependencies: Phase 0; may be prepared independently of Phase 1, but local validation remains sequential. Priority: P0. Estimate: half to one day.

### Files to adapt

Product `src/features/operations/hooks/use-milp-calculation.ts`, `copilot/AlternativePlanReview.tsx`, `OperationsDashboard.tsx`, `src/lib/analytics-api.ts`, and existing canonical-results browser spec. Add a focused hook/lifecycle test next to the hook using the existing test environment.

API inspection points: `services/grid-data/src/grid_data/api/submission.py`, `store.py`, `routers/facility.py`, `routers/jobs.py` and `tests/test_facility_experiment_api.py`. Engine inspection point: `application/experiments.py`.

### Implementation

1. Reproduce F2 by mounting a fresh experiment panel with an accepted baseline and private capability; confirm no existing normal-plan snapshot is present.
2. Separate normal-plan and experiment run contexts. Prefer named entry methods such as `runPlan`, `runExperiment` and `resumeJob` on the existing hook rather than a growing list of optional positional arguments.
3. A normal plan freezes its canonical request and scenario identity. An experiment freezes its validated `ExperimentRequest`, baseline job ID, baseline result fingerprint and proposal digest. Experiment submission must not require or rebuild a synthetic normal-plan snapshot.
4. Resume polling from the stored run context and known job ID, not mutable inputs from the current panel. Reject a result if job identity, baseline fingerprint, case IDs or experiment lineage do not match the frozen request. Clear previous job/result state at the start of a genuinely new run.
5. Do not show results after unmount, cancellation or identity change. Use the existing request-lifecycle pattern or an equivalent run generation token. Prevent an old request's `finally` block from clearing a newer run's busy state.
6. Keep one in-flight submission per panel and explicit confirmation. After an unknown POST result, never automatically resubmit. If an ID is known, offer polling that job. If no ID is known, offer authenticated job-history investigation through the existing owner-scoped API before any new submission.
7. Preserve existing server deduplication. Test sequential and concurrent identical submissions per owner, job type and payload; distinct owners and modified payloads must remain isolated. The existing RPC name is not proof of its currently deployed guarantees: verify the existing SQL and deployed qualification evidence. No new migration is authorised by this plan.
8. In `AlternativePlanReview`, reset confirmation when baseline, proposal digest, mode, asset or value changes. Show the actual import-target margin preserved by `changed_request`, not just a vague “unchanged inputs” sentence. Label assumptions about reserve/SOC fractions explicitly.

### Gate

A fresh private experiment panel submits exactly once, accepts its own result, can resume a known job and leaves the original baseline visible. Public sessions continue to show their current supported synthetic alternative boundary. This phase must not turn on exact public experiments.

## 6 Phase 3 Record provider stages and apply usage policy

Dependencies: Phase 1 output contract. Priority: P0 for receipts, P1 for policy hardening. Estimate: half to one day.

### Files to adapt

Product `src/server/operations/copilot.ts`, `copilot-handler.ts`, `copilot-composition.ts`, `src/features/operations/copilot/contracts.ts`, `PlanConversation.tsx`, `PlanCopilot.tsx`, `scripts/configure-copilot-secret.mjs` and `docs/copilot-provider-analysis.md`. Add a small provider-policy module/test if needed; keep it within the existing server boundary.

### Implementation

1. Add an optional stage receipt list: stage (`interpretation`, `claim_selection`, `brief_selection`), requested provider/model, served provider/model, response ID, elapsed time, status, successful token usage and fallback reason. Include attempts in order; do not deduplicate away multiple paid requests.
2. Keep existing calculation receipt fields unchanged. Explain mixed providers as mixed providers. A deterministic path has no invented provider call or token usage. Missing usage remains unknown, not zero.
3. Add cached/reasoning usage only when the provider returns documented fields and fixtures cover them. Estimate cost using a versioned price snapshot and label it an estimate; do not claim an invoice or include failed-call costs that are not known.
4. Keep one bounded request deadline and at most one configured provider fallback. Preserve no-fallback behaviour for authentication failures, refusals, malformed output and invalid evidence. Test the two-stage sequence after a fallback, not just one isolated HTTP request.
5. For qualification require Meta-only generation with fallback disabled. A failed Meta call may leave a checked deterministic result, but must fail the Meta-specific success criterion. Production resilience and hackathon attribution are distinct checks.
6. Add an explicit approved model configuration for the demo, initially Standard `muse-spark-1.3`. Reject unsupported or Contributor model IDs for customer/private-data mode; do not claim a model-name check proves account-level ZDR or coding-harness settings.
7. Minimise transmitted context. Keep bounded history as today; omit credentials, account IDs not needed for the task and operational data outside the selected assessment. Do not log raw prompts or outputs in production by default.
8. Enforce applicable geography and age/access requirements at the server boundary using trusted deployment/request signals and reviewed policy. Do not trust a client-supplied country field. Return a clear unavailable state without calling Meta. This is not a substitute for sanctions or legal review.
9. Keep keys server-only, never `VITE_` variables, and preserve redirect protections. Update privacy/AI notices to describe actual providers and data categories. Do not claim `store:false` means ZDR.
10. Retain token/output/call bounds and existing rate limiter. Put a hard account-wide cost cap in the later infrastructure decision list unless an already approved atomic shared mechanism exists. An in-memory counter or notification cannot provide that guarantee.

### Gate

Receipts identify all stages honestly; Meta-only qualification cannot pass using OpenAI fallback; invalid private-data model configuration fails before transmission. Account/credit/retention checks are documented separately from code tests.

## 7 Phase 4 Build a reliable investigation and comparison experience

Dependencies: Phases 1 to 3. Priority: P1. Estimate: one day.

### Reuse and adapt

- `copilot/experiment-proposal.ts`: interpretation-to-reviewed-request compiler.
- `copilot-capabilities.ts`: server capability inventory.
- `copilot/AlternativePlanReview.tsx`: review and comparison UI; extract a small `ExperimentComparison.tsx` if complexity warrants it.
- `copilot/use-plan-conversation.ts`: attached experiment identity.
- `copilot/PlanConversation.tsx`, `OperationsDashboard.tsx`: entry points and inspection navigation.
- `src/features/analytics/experiment-contracts.ts`: existing request, result and comparison schemas.
- Engine `application/experiments.py`: canonical changes, fixed-command replay and comparison metrics.

### Implementation

1. Use the existing query/proposal compiler, including supported units, exact asset selection, set/multiply resolution and four-change/four-case budgets. Do not add free-form code execution or silently relax reserve, terminal, deadline or permission constraints.
2. Display a short investigation sequence: current evidence, proposed test, confirmation, calculation state, checked result and next review. Generate hypotheses from reviewed templates and label them untested; a changed outcome does not establish a binding constraint.
3. Give modes clear names: “Keep the accepted schedule fixed and test changed conditions” and “Find a new schedule for changed conditions.” Preserve machine mode IDs. A re-optimised success does not establish that the original commands were robust.
4. Present peak import, time above target/limit, completed/total workload count, deadline status, minimum SOC, terminal target, battery delivery and rebound only when provided by the engine contract. Preserve AC/DC units and SOC fraction-versus-percent distinctions.
5. Use existing returned baseline and case metrics. Arithmetic differences may be calculated deterministically when boundaries match; do not add monetary, carbon, probability or new physical outcomes in TypeScript. If a new physical metric is required, implement it once in Fullb and qualify the contract.
6. Preserve accepted, completed-but-failed-checks, unsupported/invalid and job-failed distinctions. Do not show a dash as zero. A failed alternative has no accepted trajectory even if diagnostic values exist.
7. Bind experiment follow-ups to both the owned baseline and owned experiment. On the server validate the expected job type/schema/status and baseline fingerprint before explaining it. On the client reject attachment to a different plan and clear attachment on baseline change.
8. Make capabilities authoritative. The server checks access; UI hiding is supplementary. If the public service cannot run an exact test, explain that and offer only the existing supported synthetic path. Use an already qualified private environment for the exact demo.
9. Provide keyboard operation, focus restoration, status announcements and a narrow-screen layout. Avoid burying failures or mandatory evidence gaps under collapsed technical receipts.

### Engine changes are conditional

Start by reusing current `comparison_metrics`, `changed_request` and `replay_fixed_plan`. Add Engine changes only for a demonstrated missing or incorrect metric. Any change requires known-answer tests for interval duration, baseline immutability, protected constraints, first returned violation scope and unsupported checks. Keep experiment schemas at v1 unless a semantic break actually requires v2; consumers must be updated before rollout.

Exit gate: one successful alternative and one failed fixed-plan test are explained from actual returned results, with visible baseline lineage and no unsupported causal claim.

## 8 Phase 5 Extend the existing brief and guidance

Dependencies: Phases 1, 3 and 4. Priority: P1. Estimate: half a day.

### Files

Product `copilot/brief.ts`, `contracts.ts`, `evidence.ts`, `PlanCopilot.tsx`, `use-plan-copilot.ts`, `CopilotEvidence.tsx` and `src/server/operations/operational-knowledge.ts`. Engine replay/calibration modules remain evidence providers, not text generators.

### Implementation

1. Preserve the existing selected-plan brief, mandatory findings and export review checkbox. It already contains evidence, fingerprints, limitations and a receipt; extend it rather than build another report generator.
2. Add an investigation brief only when an owned experiment is attached. Prefer a distinct `InvestigationBrief` contract referencing the unchanged plan brief, baseline fingerprint, experiment job/result fingerprint, reviewed changes, mode, verified comparison findings and unsupported checks.
3. Build the investigation brief from server-retrieved owned results. Do not accept a browser-supplied experiment payload as evidence or splice new claims into an existing reviewed brief.
4. Invalidate review acknowledgement whenever any included evidence identity changes. Review remains session-local and is not a digital signature, durable audit approval or equipment authorisation.
5. Export human-readable text and structured JSON from the same validated object. Include provider stages, engine version, horizon, solver status/gap where supplied, scenario basis, assumptions and source IDs. Label infeasible cases and excluded conclusions.
6. Reuse the editorial guidance corpus. Add only the most relevant reviewed report summaries: backup-reserve authority, useful-work preservation, metering boundaries, recovery/rebound and delivery verification. Include source/page/applicability/excluded uses; do not upload the complete report library as a new runtime RAG system.
7. Require engineering review before promoting a summary to operational procedure. General guidance must not become a site-specific finding.

Gate: exported claims can be traced back to owned calculation evidence; a changed experiment resets review; existing brief export still works without an experiment.

## 9 Phase 6 Qualify the model and cross repository workflow

Dependencies: tests are written with each phase; final qualification follows Phases 1 to 5. Priority: P0. Estimate: one to two days including fixes.

### Evaluation architecture

Extend `scripts/qualify-copilot-conversation.ts` and `qualify-copilot-providers.ts`. Proposed fixture: `tests/fixtures/copilot-evaluation-cases.json`. Proposed pure scorer: `scripts/copilot-evaluation-scoring.ts` with unit tests. Keep fixtures synthetic or explicitly authorised; do not commit credentials, user conversations or session tokens.

Each case records an ID, question/history, fixture/scenario identity, expected intents, mandatory claim IDs, forbidden claim IDs, expected coverage, allowed clarification, evidence scope and whether an actual Meta call is required. Expected numerical answers come from independent known-answer fixtures and canonical engine results, not from model text or the same claim renderer alone.

Use at least 40 cases covering:

| Group | Minimum coverage |
| --- | --- |
| Grounding | target exceeded/met/unknown; reserve and terminal failures; completion versus deadlines; non-optimal feasible result |
| Follow-ups | named workload, peak interval, minimum SOC, references to a prior answer, conflicting untrusted transcript |
| Proposals | exact MW/MWh, relative half-size request, ambiguous capacity, multiple assets, unsupported field, stale fingerprint |
| Experiments | fixed-plan failure, successful alternative, unsupported case, wrong baseline, cross-owner result |
| Boundaries | live dispatch, guaranteed savings, uncalibrated probability, connection capacity, annual reporting |
| Resilience | 401/402/429/5xx, refusal, incomplete output, malformed selection, timeout and writer fallback |

### Scoring and proposed release gates

1. Deterministic safety suite: 100 percent pass; any wrong-identity evidence, unsupported consequential claim or unconfirmed action blocks release.
2. Live Meta run: zero critical grounding/ownership/control failures; proposed answerable-task success at least 95 percent; all required safety cases must pass individually. These are targets, not achieved results or guarantees outside the corpus.
3. Run the bounded core Meta corpus three times sequentially with the same model/configuration. Report total cases, failures by category, deterministic bypasses, invalid generations and fallback rate. Never hide fallback behind an overall “pass.”
4. Separate schema validity, routing, semantic findings, task completion and human usefulness. Remove the conversational-mode bypass of required meaning by checking claim IDs/coverage. Exact string matching may supplement but cannot be the principal semantic oracle.
5. Record source SHAs, dirty status, prompt/schema/model IDs, case version, result fingerprints, latency p50/p95, stage usage and dated cost estimate. Record failed-call usage as unknown where unavailable.
6. Have Sina review every final demo answer and a sample from each evaluation group. Domain-expert review remains a separate external milestone; do not label self-review independent expert validation.

### Cross repository checks

- Product generates the canonical browser request using the existing export test.
- Fullb consumes that exact request, performs the real solve/replay and returns the real result.
- Product accepts that result through all three projections and its claim renderer.
- The API test exercises owned baseline reconstruction, one confirmed experiment, polling, result attachment and explanation. A mocked API UI test alone does not qualify the path.
- Extend Fullb `.github/workflows/optimizer-qualification.yml` and its pinned Product source only after the relevant Product commit exists. Use existing `.github/workflows/render-free-qualification.yml` for resource qualification when runtime changes justify it.
- Use `tests/test_facility_experiments.py`, `test_facility_accounting.py`, `test_facility_http_integration.py`, `test_application_replay.py` and `test_calibration_pipeline.py` as applicable. Do not run unrelated heavy capacity studies for a text-only change.

### Resource safe local order

Check available RAM and existing test/build/dev processes before each large run. The Product runner requires 3072 MB to start and monitors memory; do not bypass its stop. All heavy stages are sequential across chats and worktrees. Unit workers: at most two; browser workers: one. Keep existing numerical libraries at one thread for Engine qualification. Preserve user-owned apps and servers.

From Product, run the relevant subset first:

```powershell
npm run verify:local -- unit src/server/operations/copilot-composition.test.ts src/features/operations/copilot/verified-claims.test.ts
npm run verify:local -- unit src/features/operations/hooks/use-milp-calculation.test.ts
npm run verify:local -- unit src/server/operations/copilot-provider.test.ts src/server/operations/copilot-handler.test.ts
npm run verify:local -- operations
npm run verify:local -- checks
npm run verify:local -- browser fast
npm run verify:local -- ui tests/e2e/operations-canonical-results.spec.ts
npm run verify:local -- build
npm run verify:local -- runtime
```

New test paths are proposed, not existing commands ready to pass today. Use a native `npm.cmd`/bundled runtime path if shell resolution requires it; do not substitute an unlocked heavy run. Stop a task-owned dev server before build. One final full managed pass is justified for the settled multi-module change; do not repeat broad suites after every edit.

From Engine, after a memory/process check and with no Product validation running, use the existing API-capable environment:

```powershell
$env:OMP_NUM_THREADS = '1'
$env:OPENBLAS_NUM_THREADS = '1'
$env:MKL_NUM_THREADS = '1'
.\.venv\Scripts\python.exe -m pytest tests/test_facility_experiments.py tests/test_facility_http_integration.py -q -ra
```

Use the environment actually containing required dependencies; do not silently install a new stack. Broader planning, calibration or accounting tests follow only changed scope; broad cross-product coverage stays in CI. Existing Fullb `scripts/verify.ps1` is broad, not the first focused command.

Gate: reproducible reports separate actual Meta calls, mocked UI checks, real synthetic engine execution and measured site evidence. No universal accuracy or operational readiness claim follows from these tests.

## 10 Phase 7 Publish a qualified candidate and prepare the submission

Dependencies: Phases 0 to 6. Priority: P1. Estimate: half to one day plus CI.

1. Refresh candidate identities and verify the exact source under test. If only Product changes are required, do not rebuild or redeploy an unchanged Engine.
2. If Engine changes exist, build and seal its tested artifact using the existing release mechanism and `scripts/seal-engine-release.py`; retain wheel/dependency hashes and API pin. Never build a different wheel in the publishing step.
3. Keep `.render-core` pinned to the required reviewed Product API commit, not an arbitrary branch tip. Commit a pointer update only when necessary; do not edit duplicated API code inside the submodule as an independent fix.
4. Use existing candidate/deploy workflows: Product `.github/workflows/validate-candidate.yml`, `frontend-ci.yml`, `deploy-cloudflare.yml` and relevant MILP qualification workflows. Add new browser ownership only in `scripts/e2e-manifest.mjs`, not separate workflow lists.
5. Verify private experiment capability on an already authorised runtime before enabling the corresponding copilot flag. A flag is not evidence that the service, ownership and admission path are qualified. Public admission/schema changes and parked PR #37 remain outside this release.
6. Recheck the deployed candidate using fresh-session public planning, Meta-only explanation, brief export, stale-input invalidation and service failure behaviour. Check the private exact-test path separately. Preserve the production “Live control unavailable” health boundary or update its implementation and health contract together with explicit regression coverage.
7. Record one complete real synthetic investigation, showing provider attribution and a failed or unavailable outcome. Crop to the product viewport; use a clean browser context. Do not expose keys, personal tabs, passwords or customer data.
8. Reuse the existing narration/video assets as a starting point. Adjust length and file format to the actual rules. Show what was added during the event and distinguish modelled results from measured benefits.
9. Prepare README/submission text, architecture diagram, run instructions, evaluation summary, limitations, licences and judge-access instructions. Do not publish private repositories or credentials by implication.
10. Submit before 4 November 21:00 Eastern (5 November 03:00 Berlin), subject to the official portal's current deadline. Retain the submission receipt and verify its links.

Rollback: keep the previous qualified Product artifact/configuration and Engine artifact identifiers. If semantic generation regresses, serve checked deterministic output while retaining the solver. Disable a newly qualified capability when it fails; do not delete data or rewrite pushed history.

## 11 Optional work after the core gates

### Document assisted input preparation

Priority P2. Allow Meta to extract proposed fields from a synthetic or authorised specification. Proposed Product modules under `src/features/operations/input-review/` and a bounded server extraction route should reuse the current request validation and provider adapter. Before adding an upload route, verify existing upload/parser infrastructure; do not send arbitrary remote URLs to the server.

Extract an allowlisted structure: field name, proposed value/unit, source page/quote, uncertainty and missing required fields. Deterministic code handles supported unit conversions. A review screen shows every proposed value and its source; nothing enters the calculation until confirmed. Treat document instructions as untrusted content. Reject unknown assets, mismatched units and protected-policy changes. Set strict file/type/page/size budgets, avoid automatic persistence and evaluate extraction against known answers. A model's stated confidence is not calibrated probability.

This feature is cut first if semantic grounding or the investigation workflow is incomplete. Muse Spark supports the existing API integration; new image, segmentation or voice models are not required merely to increase the model count.

### Measured calibration and pilot work

Reuse Fullb `application/calibration.py`, `application/replay.py`, `application/uncertainty.py`, `data_center/data_readiness.py`, `profile_calibration.py` and `calibration_registry.py`. Request authorised PCC, battery, workload and cooling observations with availability timestamps and measurement boundaries. Use chronological held-out splits and the existing non-activation review pipeline. Record missing data as requested/blocking. Synthetic examples can demonstrate the workflow but cannot satisfy a measured-evidence gate.

Later milestones: approved telemetry imports, independently reviewed calibration, retrospective shadow evaluation and authorised pilot. Equipment control and market participation each require their own engineering/contractual qualification. They are not a hackathon follow-on toggle.

### Accounting and scenario uncertainty

Keep the existing `AccountingReview.tsx`, `interval-tariff.ts`, accounting schemas and Engine `application/accounting.py` as the sole pricing path. Test negative energy prices, interval alignment and incremental annual capacity liability above the prior billing peak; do not prorate annual liability into daily savings. Do not add savings claims without a reviewed tariff and comparison basis.

Existing uncertainty scenarios support sensitivity analysis. Preserve whether the mode independently re-optimises scenarios or tests common commands. Do not present assumed scenario pass rates as calibrated reliability. Do not broaden the core scope to national alerting or connection-capacity prediction while their gates fail.

## 12 Proposed change sets and dependencies

| Change set | Repository | Contents | Depends on |
| --- | --- | --- | --- |
| A | Product | F1 tests, verified claims and safe composition | Phase 0 baseline |
| B | Product | Fresh experiment lifecycle, identity checks and recovery | Phase 0 baseline |
| C | Product | Stage receipts, provider policy, privacy notices | A contract |
| D | Product | Comparison/investigation UI and reviewed export | A, B, C |
| E if required | Engine | Only demonstrated replay/metric defects and known-answer tests | Explicit failing evidence; not assumed |
| F | Product and Engine qualification files | Expanded evaluation, exact cross-repository fixtures and necessary API pin | A to E relevant commits |
| G | Delivery materials | Submission manifest, demo, README and rules checklist | All release gates |

Suggested branches: `codex/meta-verified-claims`, `codex/meta-experiment-lifecycle`, then `codex/meta-investigation-demo` for the integration candidate. These are proposals; create them only during implementation. Keep compatible changes independently reviewable, never force-push published history, and attach created PRs to the task through the app's PR attachment tool.

### Schedule and scope cuts

| Dates in Berlin | Work | Decision |
| --- | --- | --- |
| 28 to 29 October | Phase 0, claim tests/design, lifecycle fix | Establish an eligible and reproducible baseline |
| 29 to 30 October | Deterministic claims and stage receipts | No new feature until critical regressions pass |
| 30 October to 1 November | Investigation, comparison and brief | Exact private path only if already supported and qualified |
| 1 to 2 November | Live evaluation and cross-repository qualification | Fix failures before cosmetic expansion |
| 3 November | Candidate verification and video | Freeze core scope; omit P2 extraction if unfinished |
| 4 November | Access check and submission | Submit with margin before the official cutoff |

Estimates total roughly 5 to 8 focused working days, with overlap in preparation but no overlapping heavy local jobs. If capacity is insufficient, retain claims, lifecycle, receipts, one alternative and evaluation; cut extraction, new modalities, broad uncertainty UI and cosmetic expansion. Do not cut ownership, evidence identity or failure handling.

## 13 Final acceptance checklist

- [ ] Official rules and pre-existing-project conditions recorded.
- [ ] Starting commits and hackathon additions distinguishable.
- [ ] Contradictory qualitative claims blocked by deterministic claim construction.
- [ ] Fresh exact experiment submits without a normal-plan snapshot.
- [ ] Confirmation, baseline immutability, ownership and result identity enforced.
- [ ] Public versus private capabilities preserved and labelled.
- [ ] Provider stages and fallback represented truthfully.
- [ ] Standard/private-data policy and actual account settings checked separately.
- [ ] Live Meta evaluation reports all failures and deterministic paths.
- [ ] Real synthetic engine/API round trip passes on exact candidate versions.
- [ ] Failed research gates remain excluded from operational claims.
- [ ] Export review invalidates on any included evidence change.
- [ ] Fresh-session judge access and recovery paths verified.
- [ ] Final demo and submission match the actual rules and tested build.
- [ ] No PR #37-only changes, unapproved schema/billing changes or physical commands included.

## 14 Authoritative references

These sources informed the plan; verify account settings and event rules again before release. Structured output constrains format, not the truth of a claim. Keep documented model capabilities distinct from what GridPulse has actually qualified.

- [Meta hackathon event](https://dev.meta.ai/events/global-hackathon): themes, tracks and published schedule.
- [Cerebral Valley event details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details): authenticated details and current requirements to retrieve.
- [Meta quickstart](https://dev.meta.ai/docs/quickstart): existing compatible Responses integration.
- [Meta structured output](https://dev.meta.ai/docs/structured-output): schema-constrained selection.
- [Meta Responses schemas](https://dev.meta.ai/docs/api-reference/responses/schemas): request/response shapes, status and usage fields.
- [Meta pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits): dated cost estimates and Standard/Contributor distinction.
- [Meta Model API terms](https://dev.meta.ai/legal/terms-of-service): data use, keys, integrated-product responsibilities and restrictions.
- [Meta geographic policy](https://dev.meta.ai/legal/geographic-use-policy): access restrictions and model designations.
- [Meta acceptable use](https://dev.meta.ai/legal/acceptable-use-policy): infrastructure risk, oversight and disclosure obligations.
- [Meta Zero Data Retention](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention): separate account enablement and limitations.
- [European Commission transparency guidance](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations): AI interaction and generated-content transparency.
- [European Commission critical infrastructure examples](https://ai-act-service-desk.ec.europa.eu/en/critical-infrastructure): intended-purpose and safety-component distinctions.

Local implementation evidence is in the files named in each phase. Historical test counts in existing documents are not new passes for this candidate. Phase gates become complete only when their own recorded validation succeeds.
