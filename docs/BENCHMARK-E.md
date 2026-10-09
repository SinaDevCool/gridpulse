# Benchmark E — prospective holdout safety and calibration

## Objective

Benchmark E tests predictions that were frozen before previously unseen operator outcomes became
available. Benchmark D can reveal retrospective agreement, but retrospective cases can still be
affected by case selection, tuning or temporal leakage. Benchmark E records and tests the time order.

The benchmark evaluates firm N-1 import capacity because this is the safety-governed quantity most
likely to be presented as dependable capacity. It also tests uncertainty intervals and binding
constraints rather than only a point estimate.

## Prospective protocol

Each prediction must contain:

- case and site identifiers;
- timezone-aware issuance time;
- firm-capacity point estimate;
- lower and upper uncertainty bounds;
- predicted binding constraint;
- voltage class, season and security case.

Each independently received outcome supplies the same case/site key, timezone-aware observation
time, operator firm capacity and binding constraint. Every prediction must precede its outcome.
Equal or later timestamps are leakage and fail the complete benchmark.

## Statistical metrics

Benchmark E reports:

- holdout case, site and operating-stratum counts;
- prediction/outcome coverage;
- firm-capacity MAE, P95 error and bias;
- unsafe-overstatement count and rate;
- one-sided 95% Wilson upper confidence bound on the unsafe rate;
- uncertainty-interval empirical coverage;
- binding-constraint accuracy;
- explicit unsafe cases and temporal violations.

The confidence bound prevents “zero failures” in a tiny sample from being interpreted as strong
safety evidence. With zero unsafe cases, four samples still have an upper bound above 15%; twenty
samples reduce it below the bundled 15% rehearsal threshold.

## Default rehearsal policy

- at least 20 matched prospective cases;
- at least 4 distinct sites;
- at least 4 voltage/season/security strata;
- at least 95% outcome coverage;
- MAE no greater than 0.25 MW;
- P95 error no greater than 0.5 MW;
- zero overstatements above 0.25 MW;
- one-sided 95% unsafe-rate upper bound no greater than 15%;
- uncertainty-interval coverage at least 90%;
- binding-constraint accuracy at least 95%.

The 15% bound only makes the 20-case software rehearsal statistically coherent. A utility pilot
should pre-register a substantially tighter risk limit and the sample size needed to support it.

## Evidence and leakage controls

Real operator validation additionally requires:

- operator-supplied evidence origin;
- a prospective, pre-registered protocol;
- proof predictions were frozen before outcomes;
- operator approval and permission to use outcomes;
- matching pre-registration, frozen-prediction and outcome hashes;
- Ed25519 evidence signature verified with a separate trusted public key.

The evidence file is not trusted merely because it says these conditions are true. Its content must
verify against the configured trust anchor.

## Synthetic rehearsal

```powershell
npm run grid:benchmark:e
```

This generates 20 deterministic, pre-outcome synthetic predictions across five sites and writes
`output/benchmark-e.json`. Expected state:

- prospective numerical validation: passed;
- operator prospective validation: not passed;
- validation class: `synthetic_demonstration`;
- capacity claim/display: false.

## Real invocation

```powershell
$env:PYTHONPATH=(Resolve-Path 'services/grid-data/src').Path
python -m grid_data.cli validate-benchmark-e `
  --predictions D:\pilot\frozen-prospective-predictions.json `
  --outcomes D:\pilot\later-operator-outcomes.json `
  --evidence D:\pilot\prospective-protocol-evidence.json `
  --trusted-public-key D:\pilot\trusted-operator-key.pem `
  --minimum-cases 100 `
  --minimum-sites 10 `
  --minimum-strata 8 `
  --output D:\pilot\benchmark-e.json
```

Externally supplied data exit non-zero unless the numerical and signed prospective-evidence gates
both pass.

## Interpretation boundary

Even a prospective pass is evidence about the registered sample and protocol, not proof of
universal German-grid accuracy. General claims require representative operators, voltage levels,
geographies, seasons, load types and security policies. Benchmark E does not itself constitute an
operator connection offer, reservation, contractual flexible envelope or permission to publish
node-level capacity.
