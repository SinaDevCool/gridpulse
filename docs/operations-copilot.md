# Operations plan copilot

The copilot explains one accepted MILP assessment. It reuses canonical job acceptance,
compute/battery selectors and existing ownership checks. It does not optimise, dispatch,
create a queue or save anything to a database.

## Evidence and claims

`copilot/evidence.ts` projects typed facts with value, unit, scope, availability and
source selector/field/tab. Available false/zero values remain distinct from unavailable
and not-applicable values. The envelope retains job/input/result/model identity, engine
version, solver outcome/gap, provenance, horizon boundaries and interval durations.
Target compliance uses the existing canonical selector's tolerance, not rounded labels.
AC delivery and DC stored/terminal energy are separate facts.

`copilot/brief.ts` constructs eligible claim types before contacting OpenAI. The model
selects IDs and review-action categories, not prose or numbers. Missing and failed checks
are mandatory; Summary, Power, Workloads and Battery are always represented. Unknown,
duplicate or inapplicable claims/actions fail closed. The final brief is limited to 12
findings, including mandatory warnings. Rendering uses shared Operations formatters;
evidence disclosures and exports also retain unrounded values.

## Request and security boundary

POST `/api/operations/brief` accepts only brief version, job ID and expected result
fingerprint. `handlePlanBrief` is the single handler used by the Worker route and tests.
It retrieves the existing owned job using the caller's visitor/user bearer token.
Browser facts and arbitrary upstream URLs are never accepted. Only the provider key,
not the caller's token, goes to OpenAI. No service-role credential is used.

Budgets: 2 KiB request, 4 MB upstream job, 32 KB provider input/response, 800 output
tokens. Analytics/provider calls time out after 30/45 seconds. Provider refusal,
incomplete/malformed output, quota exhaustion, timeouts and failed validation do not
produce a checked brief. No automatic retry occurs. `store:false` is sent to OpenAI.

The versioned receipt includes job and assessment fingerprints, engine/solver/model,
optimality gap, horizon/resolution, evidence/prompt versions, generation time and provider
response/usage metadata when returned. Token counts are diagnostic, not monetary costs.

## UI and lifecycle

One dashboard-owned hook shares the brief across all three tabs. The synchronous
request gate excludes duplicate calls before React renders. Generation tickets and
abort signals prevent late responses from replacing a newer assessment. Input changes,
replacement results and unmount invalidate/cancel applicable state; tab/time inspection
alone does not regenerate. Browser cancellation does not guarantee provider cancellation.

Each section has keyboard-accessible evidence disclosures and actions to the existing
Operations tab. Human acknowledgement unlocks clipboard/text export and records its
timestamp. It is not operational approval. No user notes or PDF subsystem is introduced.

## Configuration: local only until separately approved

Use the ignored `.dev.vars` beside `wrangler.jsonc` for server-only `OPENAI_API_KEY`,
`COPILOT_ENABLED=true`, `COPILOT_MODEL=gpt-4o-mini`, and `COPILOT_ANALYTICS_URL` matching
the trusted analytics service. Never prefix secrets with `VITE_`, commit env files, or
include local secret files in artifacts. Preserve existing `.env.local` client settings.
Restart local preview after changing configuration. Missing configuration fails closed.

The separate `COPILOT_RATE_LIMITER` allows two requests per IP per minute. It and the
session cache are not global spending caps. Public activation requires a separate
release/budget decision; no durable accounting resource was added. No production secret,
Supabase schema, solver runtime, billing setting or deployment was changed.

## Qualification and Task 9

Focused tests cover no battery, unavailable/false checks, 15/30/60-minute horizons,
unrounded compliance, wrong references/claims, receipt/export, duplicate and stale
requests, ownership/version/payload boundaries, limiter failures and provider errors.
The existing canonical browser spec covers generation, evidence keyboard access,
review-gated export, tab persistence, mobile accessibility and replacement inputs/results.
The existing focused CI workflow owns this coverage; there is no additional test queue.

A real 96-interval synthetic hosted MILP result passed the actual handler over a local
HTTP bridge and returned a checked v2 OpenAI brief. This qualifies provider/ownership/
handler integration, not deployment in the Cloudflare runtime. Worker build and mocked
browser qualification remain separate evidence. Latest test receipts and generated
briefs are under ignored `.codex-tmp/copilot-task9/`. See `task9-copilot-demonstration.md`
for the demonstration sequence and evidence labels.

## Conversational inspection

`POST /api/operations/conversation` accepts `operations-conversation-v1`, an owned job
ID/fingerprint, a question (up to 1,000 characters), up to six prior user questions and
selected tab/interval/workload context. Body limit is 16 KiB. Assistant text and browser
facts are never trusted evidence. `ownedAssessment` is the same acceptance/ownership
path used by briefs; provider calls share `requestCopilotSelection` and the same limiter
key. Two requests per IP per minute applies across both interfaces, not separately.

The interpreter returns a strict typed query only. Workload IDs are constrained to the
accepted job inventory. `conversation-query.ts` executes read-only queries through existing
canonical selectors and renders numerical answers through the shared fact formatter.
No generated SQL, Python, arbitrary code, solver changes, queue or database is introduced.
Definitions are curated general explanations and are labelled separately from model
evidence. Every answer exposes the resolved query, typed evidence and versioned receipt.

Supported queries cover summaries, limits, checks, intervals/ranges, workload schedules,
declared constraints, reserve/dispatch events and definitions. Ranges of more than four
intervals return labelled representative boundary/peak/minimum-SOC intervals, with chart
navigation for the full range. First/last workload activity does not imply continuous
execution. Unknown workloads, off-grid times and unresolved language request clarification.
Unsupported causal preference questions disclose absent diagnostics. What-if requests
return `requires_calculation` and direct users to review inputs and explicitly run the
existing optimiser; they do not edit or submit alternatives. Equipment control, unmodelled
cost/carbon savings and live guarantees are unsupported.

One dashboard-owned conversation persists across tabs, with at most 20 visible turns and
six user questions sent as context. It resets when inputs become stale or an accepted plan
is replaced. The lifecycle gate blocks synchronous duplicates and rejects late answers;
Stop retains the typed question for retry. Requests time out after 80 seconds in the browser.
Chart links validate the result's interval/job IDs and reuse dashboard selection state.
Brief review/export is separate: conversation answers are not implicitly human-reviewed.

Run the deterministic tests in `copilot/conversation-query.test.ts` and the handler tests
in `server/operations/copilot-conversation.test.ts`. The existing canonical browser spec
owns conversation accessibility, follow-up display, cancellation, persistence and staleness.
The focused qualification workflow includes these tests and remains non-deploying.

`node --import tsx scripts/qualify-copilot-conversation.ts` is an opt-in paid-provider
qualification, requiring existing local OPENAI_API_KEY and VITE_SUPABASE_URL /
VITE_SUPABASE_PUBLISHABLE_KEY environment settings. It creates one synthetic hosted MILP
job and runs a bounded question dataset through the production handler with a limiter
test adapter. It writes no secrets and reports under ignored
`.codex-tmp/conversation-qualification/results.json`. It measures routing, response kind,
follow-up focus, elapsed time and provider usage. This is not a Cloudflare-runtime
deployment test, production activation, human review or proof of arbitrary-question accuracy.
