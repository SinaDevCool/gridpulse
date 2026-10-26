# Interchangeable copilot and bounded operational analysis

## Ownership and reuse

The existing conversation and brief routes retain authenticated assessment retrieval and result-fingerprint checks. Both call the same structured-selection transport in `src/server/operations/copilot.ts`. No second chat service, optimizer, schema migration, vector service or agent framework is introduced.

The language model interprets/selects; canonical selectors and application code remain the source of numerical answers. Risk-review questions gather existing checks, power outcomes and submitted restrictions in a bounded read-only pass. A named-workload question keeps its original scope. Range energy integrates every accepted interval, rather than treating representative chart samples as totals. Missing power/duration remains unavailable.

## Provider setup

Server-only ignored `.dev.vars` for local testing:

```
COPILOT_PROVIDER=meta
COPILOT_MODEL=muse-spark-1.3
COPILOT_FALLBACK_PROVIDER=openai
COPILOT_FALLBACK_MODEL=gpt-4o-mini
```

Keep the existing `META_API_KEY` and `OPENAI_API_KEY` secrets in that file. Never prefix these keys with `VITE_`. Meta requires an explicit model in the handler. Omitting provider selection preserves the existing OpenAI default; this change does not activate Meta in production.

The deployment workflow now accepts the same repository variables and server secrets. Its installation script sends secrets on stdin, validates the analytics origin, and clears disabled fallback configuration. No deployment is performed by development or qualification scripts.

Official compatibility: https://dev.meta.ai/docs/quickstart and https://dev.meta.ai/docs/reasoning . The Meta adapter uses Responses, `store:false`, low reasoning and a bounded output budget. Strict output is still checked by application Zod schemas.

## Failure and usage behavior

One explicitly configured fallback is allowed for billing, throttling, transient server failures or network TypeError, within the original model-request deadline. Authentication failures, refusals, malformed output and failed evidence verification do not trigger fallback. Redirects never forward credentials. Receipts record selected provider, attempts, elapsed time and successful-response token usage. These are not an account-credit balance or a complete billing ledger: unsuccessful attempts may incur provider usage that is not returned.

Existing per-IP rate limiting remains active. Output/body/time limits bound individual requests. An atomic account-wide spending cutoff is NOT provided by an in-memory counter; adding one requires an approved shared store/configuration. No paid database or infrastructure is provisioned.

## Conversation and guidance

Recent resolved queries are passed as bounded, provider-neutral untrusted hints alongside user questions. They carry no trusted assistant facts. Every resulting query is resolved against the newly retrieved owned assessment. Existing identity changes clear the conversation.

`operational-knowledge.ts` is a small versioned retrieval corpus with public sources. Retrieval is deterministic and separate from calculated evidence; the UI labels it general operational guidance. It is not comprehensive equipment guidance or a claim that the facility is safe. More reviewed documents can be added to this one corpus before introducing embeddings. Customer documents are not uploaded or persisted.

## Alternative calculation

The existing chat's requires-calculation response exposes one review component. The user explicitly chooses battery MWh, discharge MW or import MW, enters the exact value, reviews the current/proposed values and confirms. The existing scenario schema validates the change, and `useMilpCalculation`/the existing job API execute it. The baseline stays displayed. Only an accepted alternative is compared.

A local submitted latch prevents repeated clicks; a known job ID can be checked again after polling failure. Unknown POST status is clearly shown and is never retried automatically. This is not cross-session server idempotency. No database migration or hidden server-side action is added. Reopening another session cannot provide a global deduplication guarantee.

## Qualification

- Managed server and copilot unit tests, then sequential checks and the existing canonical-results browser spec.
- `scripts/qualify-copilot-providers.ts` is an opt-in tiny real-provider schema check; it prints only provider/model/status/token counts.
- `scripts/qualify-copilot-conversation.ts` supports either configured provider for the larger synthetic hosted-job corpus; it never deploys.
- Real provider schema smoke checks are not a substitute for domain-answer evaluation or live production qualification.

No production settings, Supabase schema/data/billing, parked PR 37 or Python optimizer code are changed.

## Local validation completed

- 58 focused tests across 10 server/domain test files passed.
- Sequential tooling tests, encoding, typecheck, architecture and lint passed (one existing visualization Fast Refresh warning).
- Production build and asset budgets passed.
- Compiled-Worker canonical-results browser spec passed, including explicit alternative confirmation, one submission, accepted comparison and baseline preservation. Final mobile alternative screenshot was visually inspected.
- Real Muse Spark 1.3 and OpenAI structured-selection smoke calls passed using existing local secrets; no credentials were printed.
- This does not claim that the larger live domain-evaluation corpus or production rollout has been completed.
