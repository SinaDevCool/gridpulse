# Linked response analysis

The response explorer is a presentation composition over the existing assessment. It does not schedule jobs, dispatch equipment or change calculation contracts.

## Scope

- Display/assessment window: peaks and time above facility limit.
- Inspection range: chart brush and interval records, not aggregate recalculation.
- Effective interval: transient row preview, otherwise pinned timestamp.
- Full planning horizon: recovery, reserve constraints and unfinished work.

`useInspection` uses the existing presentation store for the pinned scenario timestamp. Preview state is disposable and bound to the current points reference. Power keeps historical selection separate and scopes previews to evidence mode and assessment identity. Pinning clears previews; leaving rows restores pinned selection. No inspection action fetches an assessment.

Table interactions share `intervalRow`, while domain-specific tables retain their own columns, filters and accessible native time buttons. Pointer click anywhere outside a nested control pins the timestamp. Focus/hover previews are not persisted and do not move focus or automatically scroll another view.

Overview composes chart peak annotations, explicit-duration breach lanes and ResponseExplorer. Peak difference compares independently occurring peaks, not necessarily a same-time reduction. `selectBreachSpans` merges only adjacent explicit-duration intervals and leaves gaps/missing duration unpainted; summary totals remain authoritative. Legends affect visibility only.

ResponseExplorer reuses ScenarioDecisionTable, OperatingEnvelopeMap, ResponseBreakdown and PlanObligations. The interval lens preserves signed battery charging and recovery load. The headroom lens remains illustrative, not contractual connection capacity or full-horizon feasibility. Recovery and reserve warnings remain visible regardless of lens.

Overview compares response plans; Compute investigates candidate workload timing; Power investigates electrical response and reserve constraints. Shared interaction primitives do not duplicate their domain calculations or impose one table schema.

## Release

No database, worker runtime, assessment API or Supabase changes are required. PR #37 remains parked. Validate unit projections, linked row interactions, keyboard controls, mobile accessibility, no-request inspection behaviour and existing cross-tab assessment controls. Use the resource-safe sequential validation runner.
