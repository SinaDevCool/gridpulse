# Operations assessment consistency release

## Boundaries

Production baseline: `ba2bde0` (PR #46). PR #37 remains parked. This release adds no database migrations, Python runtime, worker service, schema changes or billing changes. Physical dispatch remains locked.

## Implemented

- One versioned scenario/evidence request, input fingerprint and assessment shared across the three tabs. Display selection is not a planning input.
- Imports preflight through this same API; successful responses seed the same query cache. Imports and recalculations cannot silently reuse a result with another input fingerprint.
- Shared causal BMS alignment, explicit timezone validation and duplicate rejection, including small imports. Historical analytics rejects irregular timelines instead of assigning measured energy to gaps.
- Workload shifting is capped by active-to-idle compute demand, not non-compute facility load. Imported job eligibility and overlap constrain synthetic flexibility; synthetic inventory respects configured GPU capacity.
- Device/IT power is converted to explicitly assumed facility-equivalent power with PUE. Other facility load is a disjoint residual; this is not a measured annual PUE model.
- Battery capability and the envelope share ramp, dwell, energy, availability and SOC constraints. Optional declared critical-load/autonomy assumptions protect additional reserve energy without creating stored energy. SOC presentation identifies end-of-interval state.
- Verification distinguishes evaluable data, achieved performance, baseline review and recovery coverage. Zero delivery and negative deviations cannot be reported as success.
- German reporting context has a dated evidence-review contract, annual-boundary checks, source references and explicit human applicability review. It never certifies compliance or applies proposed legislation as enacted law.
- Existing canonical adapter remains the only route to validated scheduling. The public scenario service explicitly reports engine/model blockers.

## Intentionally unavailable, not implemented by a duplicate solver

The public comparison baseline is synthetic. Meter records are retained and aligned as observations; they do not become a forecast or prove the job/electrical model. Imported job windows constrain the scenario, but are not a validated schedule. GPU sample completeness is not fleet coverage. Envelope margins remain illustrative, not statistically calibrated.

Joint scheduling, forecast calibration, equipment commissioning, measured backup autonomy and certified market delivery require the reviewed canonical artifact, site model and customer evidence. Its Python handler imports `capacity_backtest.application.run_facility_plan`; the production application does not contain that optimizer. Installing or deploying an unapproved replacement is outside this release. Do not resume parked PR #37 to bypass these gates.

## Evidence definitions

- Positive battery power is discharge; negative is charging.
- Battery energy is nominal before SOH and SOC-window derating. Required reserve is the larger of the SOC floor and declared critical AC load × autonomy / discharge efficiency.
- Uploaded operating limits cannot increase the configured analysis limit. A tighter uploaded limit is applied as a declaration, not a reviewed contract.
- All energy/recovery calculations precede display-window filtering. A met power target is distinct from recovered work or a validated schedule.
- Imported records and the query cache are session-only; nothing is saved to Supabase by this flow.

## Validation gates

Unit regressions cover one-GPU/non-compute load, tiny inventory, backup energy, ramp capability, failed verification, German evidence, temporal validation and shared request identity. Browser regressions cover accepted imports sharing one assessment ID across all tabs, recalculation invalidation and rejected imports preserving accepted evidence. Existing Operations/accessibility/responsive, compiled Worker API and Finder regressions must pass before release.

## Legal sources reviewed 22 October 2026

- https://www.gesetze-im-internet.de/enefg/__11.html
- https://www.gesetze-im-internet.de/enefg/__12.html
- https://eur-lex.europa.eu/eli/reg_del/2024/1364/oj
- https://www.bundestag.de/dokumente/textarchiv/2026/kw39-de-energieeffizienzrichtlinie-1211306

The internal 90-day evidence-review freshness check is a product policy, not a statutory deadline. Deployment does not establish legal compliance.
