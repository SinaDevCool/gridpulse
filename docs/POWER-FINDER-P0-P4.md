# Power Finder P0–P4 permutation pipeline

## Product boundary

P0–P4 is an internal synthetic/physics-verification pipeline. It does not reproduce GridCARE's proprietary methodology and does not establish available German grid capacity. Public, SimBench, SMARD, DWD, MaStR and redispatch data create operating context; only a reviewed operator network model and operator validation can support a connection-capacity claim.

Every result carries a validation class. Capacity fields are rejected unless `physics_verified=true`. Surrogate predictions are never capacity outputs.

## P0 — foundation

- Canonical hashing makes datasets, scenarios and runs reproducible.
- Versioned scenario, physics-outcome and provenance contracts form one audit boundary.
- Only `operator_confirmed` permits a capacity claim.
- P0–P4 database tables are service-role-only, protected by RLS, with anonymous access revoked.

## P1 — deterministic permutations

- Stable Cartesian generation covers demand, renewable output, queue, reinforcement delay, switching, contingencies and flexibility availability.
- Invalid normal-plus-contingency combinations are excluded.
- Every case independently runs AC import and export searches via `NetworkStudyProvider`.
- Model version plus scenario hash is the cache/idempotency key.
- Failed cases are quarantined; aggregation reports firm minimum, worst case and binding frequencies.
- The API accepts 100,000 scenarios and a regression gate verifies 10,000 unique deterministic cases.

## P2 — German-context ensemble

- Historical row replay preserves demand-weather-renewable correlation and requires three weather years.
- Seeded block bootstrap perturbs queue volume, reinforcement delay and flexibility availability.
- Winter-peak/low-wind, high-renewable/export and flexibility-unavailable stresses are explicit.
- Results report minimum/P10/P50/P90, constrained hours, indicative curtailed energy, coverage and binding probabilities.
- A convergence gate checks percentile stability.

Existing C2 adapters retain licensed SMARD, DWD, MaStR and redispatch snapshots. Historical rows keep source references; sampled rows are labelled probabilistic.

## P3 — physics-labelled surrogate

- Only successful physics-verified rows enter training.
- Gradient boosting estimates feasibility, capacity boundary and binding class; a tree ensemble measures disagreement.
- Registry data includes dataset hash, features, bounds, metrics and approved/prohibited use.
- Out-of-distribution and uncertain cases return to the physics solver.
- The registry records `operator_trained=false` unless later evidenced.

## P4 — active learning and rare events

- Acquisition prioritises violations, boundary proximity, uncertainty, disagreement and out-of-distribution states.
- Mandatory N-1 contingencies are always selected before learned priorities.
- Bounded rare-event search seeks the lowest physics-verified credible case.
- Promotion requires false-safe and holdout-error gates; failures require rollback.
- Stopping requires budget exhaustion or stable percentiles, uncertainty and constraint discovery.

## Runtime and validation

Authenticated clients submit `POST /v1/jobs/p0-p4-permutation` and poll the existing job endpoint. Heavy solves/training stay in Python; the Cloudflare Worker exposes none of the private tables.

Validation progresses from `synthetic_demonstration` through unvalidated/reconciled/reviewed operator models to `operator_confirmed`. Short-circuit, protection, harmonics, dynamics, queue status, contractual availability, cost and delivery date remain separate evidence requirements.
