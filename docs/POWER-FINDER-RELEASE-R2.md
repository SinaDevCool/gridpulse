# Power Finder Release 2 — physics-routed learning

Release 2 completes P3 and P4 of the private permutation roadmap. It accelerates scenario
selection; it does not calculate or publish German grid capacity independently of the physics
solver and network operator.

## P3: physics-labelled surrogate

- Training accepts only successful `physics_verified` outcomes.
- Twelve features represent demand, renewables, queue, reinforcement delay, battery and load
  flexibility, contingencies, switching, and nodal project/reinforcement counts.
- Explicit holdout scenarios are used when supplied. Otherwise a deterministic hash split creates
  a disjoint holdout; training and holdout hashes are recorded.
- Metrics include holdout MAE, P95 absolute error, false-safe rate, label range, label diversity,
  and feasibility accuracy where both classes exist.
- Random-forest tree disagreement supplies the uncertainty span. Values outside learned feature
  bounds are marked out of distribution.
- Every prediction carries `requires_physics_verification=true` and
  `display_as_capacity=false`. Database checks enforce the same boundary.
- Joblib artifacts are trusted internal files only and carry a SHA-256 manifest. Do not load an
  artifact received from an untrusted party.

## P4: active learning and rare events

- Candidate acquisition combines predicted violation, boundary proximity, uncertainty,
  disagreement and out-of-distribution distance.
- Mandatory N-1 cases are selected before learned priorities and cannot be displaced by the batch
  ranking.
- Selected cases return to `NetworkStudyProvider`; only verified outcomes can extend training.
- A bounded deterministic stress search seeks the lowest verified capacity case.
- Promotion requires the false-safe gate, acceptable holdout error and non-degenerate capacity
  labels. A failed gate records rejection and rollback.
- The stopping rule requires budget exhaustion or stable uncertainty/boundaries with no newly
  discovered binding constraint.

## Private persistence

Release 2 records model artifacts, candidate predictions, selected physics cases, rare-event
results and promotion decisions in service-role-only Supabase tables. Anonymous and authenticated
clients have no grants. Surrogate candidate rows are structurally prohibited from being marked as
displayable capacity.

## Acceptance benchmark

```powershell
npm run grid:validate:r2
```

The benchmark uses the explicitly synthetic pilot package and the pandapower boundary. It writes
only to `output/`; no Release 2 model or prediction is shipped in the public web bundle. A rejected
promotion is a valid safety outcome when the synthetic labels lack sufficient diversity.

## Operator replacement boundary

For a pilot, replace the synthetic package through `OperatorPilotDataProvider`. Keep the holdout
period/site separate, retain mandatory operator contingencies, use operator-agreed thresholds,
and keep every surrogate-selected case behind physics verification. Promotion never changes the
validation class; only the operator validation workflow can do that.
