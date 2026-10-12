# Persistence and execution boundaries

The migration chain remains immutable. New schema changes require forward migrations.
The current schema is tested by scripts/test-operations-database.mjs rather than rebuilt from a
second handwritten SQL implementation.

| Use case                          | Access boundary                                | Integrity owner                                                |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Anonymous site/document workspace | Browser IndexedDB repository                   | Versioned anonymous-workspace schema and transactions          |
| Public Finder viewport/tiles      | Public API, accepted release/RPC               | Bounds, rate limits, source attribution                        |
| Public Operations assessment      | Bounded read-only API                          | Validated inputs and calculation version; no writes            |
| Facility workspace                | Authenticated user and facility RLS            | Owner scope, event/received cutoff and accepted quality        |
| Connector ingestion               | Source/facility-scoped credential              | Atomic RPC, duplicate batch prevention and units               |
| Saved calculation                 | Authenticated facility access then trusted RPC | Immutable input/result snapshot and version                    |
| Human review/approval             | Authenticated facility ownership               | Assessment identity; cannot approve a changed result           |
| Analytics job                     | Owner-scoped submission/read API               | Fingerprint deduplication and database transaction             |
| Worker execution                  | Service credential and worker/attempt lease    | Claim, heartbeat, checkpoint, cancellation and completion RPCs |

The application does not expose the private optimizer source. Missing model/engine evidence
must fail closed. Configuration readiness is not proof of a live connector or running worker.
Refactoring storage adapters must preserve these policies and run shared repository contract tests.
