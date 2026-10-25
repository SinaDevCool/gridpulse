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
