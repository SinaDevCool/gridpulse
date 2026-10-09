# Power Finder Release C3 — Security and flexibility

Release C3 adds a production calculation boundary for bidirectional AC capacity,
contingency screening, hourly flexibility dispatch and flexible-connection proposals.

## Implemented

- AC import and export capacity searches with voltage and thermal checks.
- Line/transformer outage execution using caller-supplied contingency sets.
- Explicit contingency coverage and an operator-approved-completeness flag.
- Hourly linear optimisation of grid import/export, battery charge/discharge and
  state of charge, flexible-load reduction, onsite generation curtailment and unserved load.
- Static and dynamic import/export limit schedules with duration, technical-control
  requirements, liability placeholder and operator-confirmation requirement.
- Constrained hours, energy reduction, curtailment, unserved energy, battery throughput,
  and annual grid energy metrics.
- Versioned persistence, public fail-closed RPC, analytics job endpoint, and Finder panel.

## Free/open benchmark inputs

- SimBench representative German distribution network (ODbL).
- SMARD day-ahead price data for dispatch context.
- Release C2 SMARD/DWD/SimBench hourly envelope artifact.

Declared customer demand, onsite PV and flexibility assets are synthetic benchmark
profiles. They are not measurements from a German site.

## Truth boundary

The bundled benchmark assesses 14 deterministic line/transformer outages to exercise
the C3 engine. It is not a complete or operator-approved N-1 set. Its zero firm
import/export result under that bounded set is retained rather than hidden. The public
map does not receive benchmark capacity as mapped-node capacity.

The §17(2b) EnWG outputs are non-binding proposals only. A network operator must agree
the magnitude and periods of restrictions, contract duration, technical requirements,
and liability. Operator topology, loading, accepted connection queue, protection data,
security policy, and reviewed contingency lists remain required for a real result.
