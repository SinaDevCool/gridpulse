# GridPulse direction: power acceleration for Germany

Updated: 18 July 2026

## Executive decision

GridPulse should not copy GridCARE's unverified capacity claims or present itself as a grid model before it has utility-grade network data and validation. It should adopt GridCARE's business architecture: sell a faster path to energized capacity, not a dashboard.

The German wedge is an evidence-led managed workflow for data-centre, BESS and large-load developers:

1. **Power discovery** — qualify candidate sites, responsible operators, connection requirements and evidence gaps.
2. **Connection activation** — prepare operator-ready connection cases and compare unrestricted, static FCA and dynamic FCA structures.
3. **Flexible operations** — turn agreed limits into operating envelopes, dispatch requirements and commercial-impact monitoring.

The near-term product must remain explicit that public data cannot confirm available connection capacity and that the network operator controls the connection decision.

## What GridCARE actually delivers

GridCARE positions Energize as a managed power-acceleration platform for data centres and utilities, with three stages:

| GridCARE layer   | Customer job                                      | Commercial value                                   |
| ---------------- | ------------------------------------------------- | -------------------------------------------------- |
| Power Finder     | Identify regions and sites with power opportunity | Avoid stranded site-development capital            |
| Power Activation | Unlock latent capacity using managed flexibility  | Reduce time-to-energize and accelerate revenue     |
| Power Operations | Monitor and dispatch flexible interconnections    | Maintain compliance while using activated capacity |

Its moat is not the interface. It combines grid models, hourly demand forecasts, large-scale contingency analysis, flexible-resource optimization, utility collaboration and operational control. Publicly stated outcomes include more than 400 MW in a Portland General Electric program and 150 MW contracted for AI Fabrik.

## Current GridPulse position

GridPulse already has useful foundations for the activation layer:

- authenticated multi-project portfolio;
- German candidate-site and likely-operator screening;
- evidence classifications and validation gates;
- interval-profile CSV ingestion;
- unrestricted, static FCA and dynamic FCA scenario calculations;
- constrained-energy, restricted-hours and indicative-exposure outputs;
- report view and design-partner intake.

The main gaps are:

| Capability         | Current state                      | Required next state                                                                        |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Site discovery     | One site at a time; public context | Comparable candidate-site pipeline with scored evidence completeness—not inferred capacity |
| Operator workflow  | Operator recorded as evidence      | Operator-specific requirement packs, correspondence log and milestones                     |
| Network modelling  | No power-flow model                | Partner or licensed model with validated topology and constraints                          |
| Flexibility design | User-entered limits and schedules  | Versioned operating envelopes tied to operator evidence                                    |
| Operations         | Scenario analysis only             | Live telemetry, alerts, dispatch instructions and compliance history                       |
| Commercial proof   | No measured customer outcome       | Pilot baselines for time saved, options identified, MW activated and capital/time impact   |

## German product boundary

The German market supports this direction. Bundesnetzagentur describes FCAs for storage and loads as a way to connect projects despite scarce capacity using static or dynamic limits, including co-location. It also notes that operators can offer these agreements but are not generally required to do so. Therefore GridPulse should prepare and quantify an FCA case, not promise that one will be granted.

For large loads, the initial focus should be data centres and co-located BESS projects with enough operational flexibility to make an alternative connection structure commercially meaningful.

## Delivery roadmap

### Phase 1 — operator-ready activation workspace

- Secure PDF and CSV document storage.
- Operator-specific application checklist and missing-evidence gate.
- Correspondence and decision log.
- Candidate-site comparison based on traceable facts and readiness.
- Versioned FCA envelope with source, validity period and approval status.
- Branded power-readiness plan export.

### Phase 2 — flexibility economics

- Data-centre workload and backup-generation profiles.
- BESS co-optimization against connection limits.
- Restricted hours, energy not served, dispatch requirement and revenue-at-risk.
- Sensitivities for static, scheduled and dynamic envelopes.
- Commercial comparison of wait-for-upgrade versus flexible connection.

### Phase 3 — flexible operations

- Telemetry ingestion and data-quality monitoring.
- Day-ahead operating-envelope import.
- Dispatch recommendations and operator instruction audit trail.
- Constraint alerts and compliance reporting.
- Integration with customer EMS/BMS and operator interfaces.

## Non-negotiable validation milestones

Before claiming "capacity found" or "power accelerated," GridPulse needs:

1. a named design partner with a real German connection case;
2. written operator evidence supporting at least one alternative connection structure;
3. an independently reviewed calculation methodology;
4. a measured before/after time or capacity outcome;
5. explicit separation between public screening, customer inputs, calculated results and operator-confirmed facts.

## Public sources

- GridCARE platform and positioning: https://www.gridcare.ai/
- GridCARE/PGE case study: https://www.gridcare.ai/post/pge-and-gridcare-accelerate-hundreds-of-megawatts
- GridCARE launch: https://www.gridcare.ai/post/silicon-valley-ai-and-energy-pioneers-launch-gridcare
- Bundesnetzagentur FCA guidance: https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzanschluss/FAQ_FCA/FCA_table.html
