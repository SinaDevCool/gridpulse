# Berlin capacity calculation pocket — Release 1

## Product boundary

Release 1 publishes a bounded Berlin methodology demonstration. The 16 model buses use real
accepted OSM substation identifiers and coordinates. The electrical topology, line catalogue,
loads, operating state and contingencies are synthetic GridPulse assumptions. The external-grid
slack bus is not published as a candidate, leaving 15 calculated map nodes.

These values are not operator-confirmed headroom, a connection offer, a reservation or a substitute
for a network study. Unknown areas remain unknown.

## Calculation

- 110 kV synthetic meshed network: a geographic ring plus nearest-neighbour chords.
- Synthetic winter-peak loads: 7–17 MW per bus at 0.96 power factor.
- N-0 import envelope: AC power-flow capacity with the intact synthetic network.
- Firm import: the minimum feasible import across every individual synthetic line outage (N-1).
- Constraints: bus voltage limits and line thermal loading, solved with pandapower Newton–Raphson.
- Search: deterministic binary search to 0.25 MW tolerance with a 300 MW ceiling.

The offline release command is:

```powershell
npm run grid:build:berlin-capacity
```

It writes `public/power-finder/berlin-synthetic-capacity.json`, including model/result hashes,
assumptions, calculation coverage, solver version and interpretation restrictions.

## Browser behavior

The web client downloads the compact committed artifact once. Required-power changes only
reclassify the 15 results in memory, so no power flow is run during map interaction. Nodes within
the Berlin pocket are coloured by the selected N-0 or firm metric; all unmatched German nodes stay
grey. A dashed polygon identifies the calculation boundary.

## Release checks

- Python model and committed-artifact contract tests.
- Result integrity hash validation.
- TypeScript capacity metric tests.
- Full frontend unit suite, typecheck, encoding check and production build.
- Interactive verification of required-MW and N-0/N-1 reclassification.
