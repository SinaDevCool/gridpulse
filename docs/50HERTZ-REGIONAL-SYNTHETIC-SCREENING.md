# 50Hertz regional synthetic opportunity screening

## Purpose

This pipeline ranks public 50Hertz-tagged 380 kV substation locations for further diligence.
It delivers the product structure of a grid-opportunity screen: conservative, central and
optimistic firm proxies; flexible and BESS-assisted proxies; restricted hours; and an
explainable binding synthetic outage.

It does **not** calculate actual available capacity. OSM supplies names, coordinates, operator
tags and voltage filters. GridPulse mocks the network, ratings, loads, switching, contingencies
and operating envelopes.

## Reproduce

Retrieve the recorded Overpass query into `work/50hertz-overpass.json`, then run:

```powershell
npm run grid:build:50hertz-regional
```

The output is `output/50hertz-regional-screening.json`. Its source hash, assumptions, formulas,
scenario results and safety flags make the screen auditable.

## Calculation plan implemented

1. Filter named OSM substations tagged to 50Hertz at 380 kV or above.
2. Deduplicate names and select 20 geographically distributed candidates.
3. Construct a deterministic synthetic 380 kV nearest-neighbour mesh.
4. Run conservative, central and optimistic electrical assumptions.
5. At each non-slack site, binary-search incremental import with an AC solver.
6. Repeat under every incident synthetic-line outage and retain the worst case.
7. Simulate 27 hourly demand/renewable/weather cases and a four-hour BESS policy.
8. Rank on conservative firm proxy first, then flexible value and restricted hours.

## Required promotion evidence

Before any result may be called capacity, replace the synthetic topology, line and transformer
ratings, base state, switching, outage list, hourly telemetry, project queue and reinforcement
plan. Reconcile predictions against time-aligned 50Hertz studies and obtain permission to
represent the resulting capacity.
