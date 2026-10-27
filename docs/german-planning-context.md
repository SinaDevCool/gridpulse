# German planning context implementation

The existing Operations form, canonical request, job API, accepted-result projection,
engine solver/replay and copilot retrieval remain the only calculation path.
No parallel solver, database, vector index, connector or billing service was added.

## Ownership and activation

Product: `src/features/operations/german-planning.ts` owns browser input validation,
Berlin local-day interval construction and mapping into the existing canonical request.
`configuration/GermanPlanningInputs.tsx` and `GermanReportingInputs.tsx` extend the
existing form. Set `VITE_GERMAN_PLANNING_ENABLED=true` only for a qualified private
runtime. It defaults to false; public synthetic submission rejects this context.
This change does not activate or deploy the feature.

Fullb: `data_center/facility.py`, `contracts.py` and `optimizer.py` own interval import
limits, operating targets and physical replay. `application/accounting.py` owns tariff
arithmetic; existing experiments, cooling, asset permissions and calibration are reused.
Deploy compatible engine/API versions together before enabling the UI.

## Input and evidence boundaries

Berlin days contain 92, 96 or 100 contiguous UTC quarter-hours. Repeated autumn times
are identified by UTC timestamps; the label helper retains their local offset.
Prices use EUR/MWh and may be negative. The normalized CSV requires exactly
`start_utc;end_utc;price_eur_per_mwh`, one UTC row per interval, with no gaps,
duplicates or interpolation. Native SMARD downloads must be normalized first.
The shared SMARD transport now also fetches quarter-hour prices; this adapter has
mocked coverage but its live endpoint was not reachable during qualification.

Optional import envelopes are nonnegative MW, cover every interval, and may not
exceed the facility ceiling. Safety targets subtract the configured reserve per
interval. Breach durations and operating margins use interval limits; gauge and
comparison markers are explicitly reference ceilings. Battery permission can only
restrict the existing policy; reserve and terminal checks still apply. PUE remains
reference-only in component accounting.

Planning metadata travels through the existing fingerprinted request. Absent metadata
is omitted from Python serialization to preserve legacy request identities. Reporting
evidence reuses `german-evidence.ts`; completeness is never legal certification.

## Accounting and copilot

V1 accounting remains energy-only. Explicit V2 adds reviewed supplier markup,
network energy and incremental annual capacity liability above a supplied prior peak.
Annual capacity charges are not prorated into a daily bill. Taxes, fixed fees, market
revenue and special tariff entitlements are not inferred. Negative wholesale prices
are not represented as negative network charges.

Curated German/English tariff, flexible-connection and reporting sources extend the
existing reviewed retrieval library. The copilot reads accepted plan facts and cannot
infer commercial enrollment, control authority, legal compliance or measured delivery.

## Qualification

Focused API/data tests, frontend unit tests, typecheck, architecture, encoding, lint
and production build are run sequentially with the repository resource-safe runner.
No paid-provider call, real customer dataset, live SMARD import, production deployment
or physical dispatch is part of this qualification. A private runtime with authenticated
access is required for end-to-end activation; public synthetic behavior is retained.

Implementation qualification: 44 focused German-planning/copilot tests passed;
16 engine optimizer/accounting/application tests passed; the real-engine experiment
API suite passed all 5 tests. Tooling, encoding, typecheck, architecture, lint and
production build passed (one existing Fast Refresh lint warning). SMARD transport
coverage uses mocked responses: current remote endpoint availability is unverified.
Browser interaction and authenticated private-runtime qualification remain release
gates before enabling the optional controls. Existing cooling/calibration models
were reused, not calibrated against new measurements in this work.
