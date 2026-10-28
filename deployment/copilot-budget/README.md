# Shared copilot budget coordinator

This candidate is not provisioned and is not referenced by the production Wrangler configuration. Its SQLite Durable Object coordinates one billing team per UTC calendar month. It has no public administrative endpoint. Reservations contain opaque request IDs and integer micro-USD amounts, never prompts or customer data.

Run `node scripts/qualify-copilot-budget.mjs` from the Product repository. The managed guard runs a local Workers runtime sequentially. Tests cover competing reservations, duplicates, unknown usage, settlement, process restart persistence and window isolation. Disposable synthetic state stays under ignored `.codex-tmp/`.

Activation requires approval of shared storage and retention, a reviewed billing-team identity and budget, and qualified deployment of this coordinator. After that, bind the Product's `COPILOT_BUDGET` to the external `CopilotBudget` class in the approved script. Set server-only `COPILOT_BUDGET_REQUIRED=true`, `COPILOT_BUDGET_TEAM` and `COPILOT_BUDGET_MICRO_USD`. If required configuration or the ledger is unavailable, paid admission fails closed. No production configuration is changed by this directory.

Reservations use the reviewed 28 October 2026 Standard Spark 1.3 pricing estimate, conservative byte-based input allowance and a 4096 output-token ceiling. Known returned usage reconciles the reservation. Unknown usage stays reserved. A known overrun stays charged and reduces subsequent admission. This is an application admission budget, not an invoice guarantee or provider-enforced spending cap. Other models are refused while this pricing policy is active. Requests made outside this application are outside its ledger.

Before activation, confirm pricing/token bounds, timezone/window policy, retention, actual account data controls and billing reconciliation. Month boundaries create a separate ledger and do not erase unresolved reservations from earlier months. Do not purge unresolved usage automatically.
