# Plan copilot

This Operations-only explanation layer reuses canonical job acceptance, full-horizon
checks and existing presentation arithmetic. It does not solve or modify a plan.
The browser sends a job ID and expected result fingerprint. The server forwards the
existing visitor/user bearer session to the configured analytics job API, which owns
authentication and job ownership. No service-role credential or new database is used.

OpenAI selects fact IDs and review actions using Responses Structured Outputs. All
displayed sentences and numbers come from the server's allowlisted evidence; unknown
IDs, duplicate references and extra prose fail validation. Required warnings are added
regardless of model selection. This deliberately constrains the first AI layer to
selection and prioritisation rather than free-form advice. It is not causal analysis.

## Local configuration

Use an ignored `.dev.vars` beside `wrangler.jsonc`, containing server-only
`OPENAI_API_KEY`, `COPILOT_ENABLED=true`, `COPILOT_MODEL=gpt-4o-mini`, and
`COPILOT_ANALYTICS_URL` matching the trusted analytics service. Never prefix secrets
with `VITE_`. Preserve existing Vite/Supabase configuration in `.env.local`.
Restart the local preview after editing environment settings. The separate
`COPILOT_RATE_LIMITER` permits two requests per IP per minute. Missing configuration
fails closed. Production activation and deployment are not included in this change.

Explicit clicks trigger generation; changing chart time or tab does not. A brief is
kept in component memory, bound to job/result/current-input identity, and invalidated
when inputs change. Human review unlocks text copy/download. No brief is stored in
Supabase. Provider calls have a timeout, bounded output, no tools, no automatic retry,
and `store:false`. Provider refusal/incomplete output never becomes an accepted brief.

The rate limiter is not a global spending cap. Before any public release, configure
provider spending controls and qualify representative cases. Do not include local
secret files in build artifacts or CI uploads. The existing MILP engine and parked
backend work remain unchanged.

## Qualification status

Focused unit/regression tests, typechecking, architecture, encoding and changed-file
lint pass locally. After API credits were added, a real hosted 96-interval synthetic
MILP job was read through its owned job API and generated eight validated findings
through OpenAI (`gpt-4o-mini`). The feasible incumbent status was preserved.
The receipt and brief are local ignored files under `.codex-tmp/`.
Browser interaction qualification is included in the existing canonical results
spec: explicit generation, review-gated export, tab persistence and stale-input
invalidation. Public activation still requires its separate release decision.
