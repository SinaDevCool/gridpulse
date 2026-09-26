# Power Finder Release R1 — German public context and physical hourly states

Release R1 completes roadmap phases P1 and P2 on top of the P0 pilot-data contract.

## Public data

- SMARD supplies German system load, generation, forecasts and price context.
- DWD supplies historical weather observations.
- MaStR supplies registered generation and storage context.
- OSM/Geofabrik supplies open geographic infrastructure context.

Each adapter preserves publisher, URL, licence, artifact hash and an evidence boundary. Public
context is never treated as feeder loading, operator topology or available capacity.

`source_quality.py` validates complete UTC intervals, duplicates, missing hours, provenance and
coverage before a release can be accepted. Database records enforce `capacity_claim = false`.

## Physical state construction

`NetworkStateBuilder` converts a validated pilot bundle and scenario into a complete immutable
`NetworkModelInput`. Supported state dimensions are effective rather than descriptive:

- aggregate or nodal demand factors scale P and Q loads;
- aggregate or nodal renewable factors scale non-slack generation;
- queue projects are added at their declared buses;
- switching states change declared switch positions;
- reinforcements add or modify electrical assets;
- selected contingencies restrict the study set;
- battery dispatch is capped by modelled power and availability;
- flexible-load reduction is capped by modelled flexibility and availability;
- weather year and hour are retained in state provenance.

Unknown switches, queue projects, reinforcements, contingencies or unsupported flexibility fail
closed. Legacy aggregate queue MW remains supported only when no nodal queue IDs are supplied.

## Acceptance command

```powershell
npm run grid:validate:r1
```

The acceptance scenario loads the checksummed P0 package, applies demand, renewable, nodal queue,
reinforcement, battery and flexible-load changes, and requires the resulting AC base case to
converge. Its result remains `synthetic_demonstration`.

## Replacement boundary

When DSO/TSO data arrives, load it through `OperatorPilotDataProvider`. The state builder and
solver do not change. Public sources remain explanatory variables; operator topology, ratings,
switching, measurements and security criteria replace only the synthetic pilot artifacts.
