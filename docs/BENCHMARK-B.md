# Benchmark B — independent AC solver validation

## Objective

Benchmark B tests whether GridPulse's calculated import boundaries survive a change of power-flow
engine. Production uses pandapower Newton–Raphson. The reference uses standalone PYPOWER's
fast-decoupled XB solver. Both receive the same exported AC case, connection bus, 0.96 incremental
load power factor, feasibility limits, search tolerance, ceiling, and contingency set.

This is stronger than Benchmark A's alternate algorithm inside pandapower. It remains an open
software benchmark—not a comparison with operator measurements or a real connection decision.

## Execution plan

For the default SimBench urban and rural MV networks, the runner performs these steps:

1. Import the open network into the governed `NetworkModelInput` contract.
2. Add two deterministic line/transformer outage cases.
3. Hash the complete input model.
4. Build the production pandapower network, including switch and transformer treatment.
5. Export the same case to PYPOWER format with connectivity checking enabled.
6. Solve the intact operating state with both engines.
7. Add the same customer load at the same bus and calculate N-0 capacity by doubling and bisection.
8. Repeat the calculation for each selected outage and take the minimum as firm capacity.
9. Compare capacity, voltage, current-based thermal loading, binding case, and binding constraint.
10. Write a deterministic JSON evidence artifact and return a non-zero exit status on failure.

## Acceptance thresholds

Every network must meet all criteria:

- N-0 absolute capacity difference no greater than 0.1 MW;
- firm N-1 absolute capacity difference no greater than 0.1 MW;
- minimum and maximum bus-voltage difference no greater than 0.0001 pu;
- maximum line- and transformer-loading difference no greater than 0.1 percentage point;
- identical binding case;
- identical binding constraint;
- feasible intact base states in both engines.

Thresholds are declared before interpreting results and are stored in the artifact. A failed metric
cannot be hidden by averaging it with passing metrics.

## Reproduce

Install the grid-data `study` dependencies and run from the repository root:

```powershell
npm run grid:benchmark:b
```

The evidence artifact is written to `output/benchmark-b.json`.

## Scientific and governance boundary

The solver implementation is independent, but the case conversion is intentionally shared. This
isolates solver and capacity-search agreement without introducing a second, unvalidated transformer
and switch translator. The artifact declares
`independence: independent_solver_shared_pandapower_case_conversion`.

`external_solver_validated` becomes true only if every configured case passes. It means the open
benchmark agreed across these two engines; it does not mean:

- a network operator approved the model or contingencies;
- the representative SimBench MW values exist at a mapped location;
- the shared model conversion was independently certified;
- telemetry, accepted-connection queues, protection, dynamics, or operational policy were tested.

A later Benchmark C should use an independently converted CGMES/operator pilot model and compare
against operator-provided solved cases or measurements. Only the appropriate operator validation
class—not Benchmark B—can support a real capacity claim.
