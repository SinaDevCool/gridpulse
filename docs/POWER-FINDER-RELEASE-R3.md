# Power Finder Release 3 — governed shadow validation

Release 3 moves the Release 2 surrogate into a private, operator-pilot validation loop. It does
not publish surrogate MW values and does not create operator-confirmed capacity.

## Delivered

- Independent shadow scenarios are solved with the physics provider and paired with internal
  surrogate predictions.
- Training and shadow identities and hashes must be unique and disjoint. Solver output is rejected
  when it contains an unknown scenario, a mismatched input hash, or a different validation class.
- Shadow metrics include physics coverage, MAE, P95 error, bias, false-safe rate, OOD rate,
  binding-constraint accuracy, and mandatory-contingency coverage.
- Feature drift compares current cases with immutable training bounds. Drift fails promotion.
- Explainability records feature importance and predicted versus verified binding constraints.
- Every observation is marked `requires_physics_verification=true` and
  `display_as_capacity=false`.
- Champion promotion is fail-closed. The public/authenticated analytics request cannot self-attest
  operator review or training permission.
- Private Supabase ledgers store shadow runs, observations, and immutable champion history. RLS is
  enabled and anonymous/authenticated table access is revoked.
- A protected reviewer-only function binds an unlinked run to a real operator-pilot workspace.
  Direct API callers cannot nominate a workspace or self-attest review or training permission.
- Database promotion requires a linked operator workspace, a reviewed/confirmed model review, an
  operator-reviewer role, a passed reconciliation referenced by that review, current signed data-use
  permission explicitly allowing model training, an operator-reconciled/reviewed validation class,
  and all technical gates.
- Approval permits internal scenario prioritisation only. It never confirms connection capacity.

## Run the acceptance benchmark

```powershell
npm run grid:validate:r3
```

The bundled benchmark is deliberately synthetic. Its expected result is `retain_challenger`,
which proves that synthetic evidence cannot cross the operator-governance boundary.
The public artifact contains only aggregate governance metrics, reproducibility hashes and the map
authority boundary. Private predictions and observations are not published.

## Private API

Authenticated callers can submit `POST /v1/jobs/release3-shadow-validation`. The request accepts a
network model, at least ten training scenarios, shadow scenarios, requested import, and mandatory
contingencies. `operator_reviewed` and `operator_training_authorized` are literal false at this
boundary; review is performed through the protected database workflow against real evidence.

## Remaining operator dependency

An internal champion requires a German operator pilot with licensed topology, ratings, switching,
loading/measurement history, outage cases, and written model-training permission. Until then,
Release 3 remains a complete synthetic shadow-validation implementation, not a real-node capacity
product.
