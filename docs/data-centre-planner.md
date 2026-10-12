# Data Centre Planner

The Data Centre Planner converts customer-declared IT requirements into energy,
water, heat-reuse and hypothetical connection-envelope scenarios. It does not
estimate available network capacity.

## RZReg performance data

The source workbook is stored outside Git in the OneDrive-backed data store:

`OneDrive/GridPulse-Data/rzreg/Rechenzentren-Verzeichnis.xlsx`

An immutable copy is retained under `source-snapshots/<sha256>.xlsx`. Run
`npm run grid:build:rzreg-performance` to create the public normalized artifact.
The artifact retains the source hash, source modification time, truth class,
permitted/prohibited uses and field-level validation warnings.

Peer calculations exclude a metric only when that metric is missing or outside
its validation range. Reported zero remains zero. A warning on one field does not
silently remove otherwise usable fields from that facility.

## Claim boundary

RZReg performance values are public/operator-reported context. Customer-entered
firm, flexible and battery envelopes are hypotheses. Neither may be described as
available MW, an official connection point, or an operator-confirmed connection.
