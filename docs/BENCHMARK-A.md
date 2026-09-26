# Benchmark A — open-network AC capacity consistency

## Purpose

Benchmark A checks whether GridPulse's production AC capacity-search path gives materially the
same answer when the nonlinear power flow is solved with a second algorithm. It runs on openly
available SimBench medium-voltage networks and includes intact-network (N-0) and bounded
single-component outage (N-1) cases.

This is a software and numerical-consistency benchmark. It does **not** estimate headroom at a
real location, reproduce a distribution-system operator study, or validate GridPulse against
measured connection outcomes.

## Test matrix

The default run imports these representative German SimBench networks:

- `1-MV-urban--0-sw`
- `1-MV-rural--0-sw`

For each network, the runner:

1. selects the imported model's connection bus;
2. applies an incremental load at 0.96 power factor;
3. solves the base case;
4. searches for the maximum feasible import using GridPulse's doubling and bisection procedure;
5. repeats the search for the first two deterministic line/transformer outages;
6. compares the production Newton–Raphson result with Iwamoto Newton–Raphson;
7. records model and benchmark SHA-256 hashes.

A trial is feasible only if the power flow converges, every active load bus remains supplied,
bus voltages remain within both the model limits and the configured 0.95–1.05 pu limits, and line
and transformer loading remain at or below 100 percent.

## Acceptance criteria

Every model must satisfy all of the following:

- both algorithms pass the intact base state;
- N-0 and firm-import capacity each differ by no more than 0.1 MW;
- base-state minimum and maximum voltage differ by no more than 0.0001 pu;
- the binding intact/outage case is identical;
- the binding electrical constraint is identical.

The command exits non-zero if any case fails. The JSON artifact preserves individual results,
thresholds, model hashes, the aggregate decision, and a deterministic benchmark hash.

## Reproduction

From the repository root, after installing the grid-data `study` dependencies:

```powershell
npm run grid:benchmark:a
```

The output is written to `output/benchmark-a.json`.

## Validation boundary and next gate

The reference algorithm runs in the same pandapower software engine as the production algorithm.
The artifact therefore declares:

- `independence: alternate_algorithm_same_engine`
- `external_solver_validated: false`
- `capacity_claim: false`

This benchmark detects regressions in model conversion, feasibility checks, contingency handling,
capacity search, and numerical agreement between two AC algorithms. It cannot detect errors shared
by pandapower or prove agreement with an independently implemented solver. A later certification
gate should export the identical network, operating point, contingency set, and incremental-load
definition to PowerModels.jl or MATPOWER and compare bus voltages, branch flows, binding cases, and
capacity limits without relaxing these tolerances after observing the results.
