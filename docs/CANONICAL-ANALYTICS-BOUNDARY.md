# Canonical analytics boundary

## Decision

GridPulse uses one directional analytical dependency graph:

```text
gridpulse-grid-core -> gridpulse-capacity-backtest -> production analytics service -> web UI
```

The web application owns customer workflows, authentication, persistence, presentation and
report delivery. The production analytics service owns authenticated job execution, retries,
artifact persistence and operational adapters. `gridpulse-grid-core` owns network contracts,
public-source parsers and electrical-study provider interfaces. `gridpulse-capacity-backtest`
owns capacity aggregation, flexibility requirements, facility planning, uncertainty, historical
replay, economics, market qualification, shadow assessment and delivery verification.

Dependencies may only point from left to right. Core modules must never import the analytical
engine, API, Supabase or browser code. Browser code must never reproduce an authoritative
analytical calculation.

## Result boundary

An analytical result is immutable and includes a schema version, engine version, input
fingerprint, evidence cutoff, source fingerprints, assumption-set identifier, truth class,
blockers and result fingerprint. Updating a project creates a new run rather than mutating a
previous result.

JSON Schema is the exchange boundary. Python and TypeScript validators are generated or tested
against the same versioned schemas. Presentation code may format, sort and filter canonical
results but may not recalculate them.

## Claim boundary

Public, customer, synthetic and derived evidence cannot be promoted to operator-confirmed by an
API adapter or UI. Capacity and operational-control claims remain false unless current,
project-specific operator evidence authorizes them.

## Replacement rule

Every integration of a canonical engine must delete, disable or explicitly label the calculation
it replaces as an illustrative preview. The tracked replacements live in
`config/analytics-deprecation-register.yaml`.

## Complementary production calculation

`storage-lcos.ts` is the sole owner of a declared storage-technology capital screen: CAPEX,
fixed and variable OPEX, charging cost, capital recovery and LCOS. It does not calculate
dispatch, verified delivery, tariffs, SLA outcomes, market settlement, avoided peaks or
historical economics. Those operational outcomes remain exclusively owned by
`gridpulse-capacity-backtest`.
