# Power Finder Release B — synthetic reference-network security screen

Release B adds a transparent, deterministic reference-network layer to Release A. It is a product
and integration prototype, not a reproduction of GridCARE's proprietary pre-trained model and not
an operator connection study.

## Versions

- Network: `de-bb-synthetic-reference-network-v1`
- Ranking: `release-b-security-ranking-v1`
- Validation: `unvalidated_reference_model`

## Screen

Each candidate receives a four-bus, three-branch synthetic radial equivalent. Branch ratings, base
loading and reactance proxies are derived deterministically from accepted voltage context, distance
and the stable node identifier. The engine calculates:

- an N-0 transfer screen;
- a conservative largest-branch-outage N-1 proxy;
- a voltage-security proxy;
- residual margin against declared minimum firm demand;
- base, high-load, outage and target-year sensitivities;
- a binding constraint and explainable security-score adjustment.

N-1 projects use the outage proxy; single-feed projects use the base screen. Release A's hourly
envelope remains separately visible and is never overwritten by Release B.

## Evidence and replacement boundary

Every branch and result is `synthetic`. The model has no operator topology, impedance, equipment
rating, loading snapshot, protection setting, fault level, contingency list or connection queue.
It does not solve AC or DC power flow or Kirchhoff equations.

Replacement requires an operator-supplied and reviewed CGMES/planning model, operational cases,
security criteria and connection-queue evidence. A model can be called validated only after its
topology, parameters and results are reconciled with the responsible network operator.

## Regulatory rationale

German flexible connection agreements can apply static or time-varying import/export restrictions,
including co-location, but the network operator controls the security assessment and agreement.
Release B helps structure the questions and compare sensitivities; it cannot establish that an FCA
will be offered or granted.
