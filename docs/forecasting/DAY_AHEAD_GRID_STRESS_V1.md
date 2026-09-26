# Day-ahead regional grid-stress forecast v1

## Decision product

GridPulse forecasts whether the German electricity system will experience elevated redispatch
activity on the following delivery day. It is a regional operating-context signal for Power Finder
and Constraints. It is **not** available connection capacity, a nodal load-flow result, or an
operator connection offer.

The public contract contains:

- `high_stress_probability`: calibrated probability from 0 to 1;
- `redispatch_mwh_p50` and `redispatch_mwh_p90`: conditional day-ahead energy ranges;
- `severity`: low, moderate, high, or critical;
- `drivers`: the strongest observed public-data features;
- `confidence`: high, medium, low, or unavailable, derived from validation and source freshness;
- complete model, issue-time, delivery-day, source, and caveat provenance.

## Target

For each delivery day, the observed target is total redispatch energy from published German
redispatch measures. `high_stress` is true when that energy exceeds the 80th percentile of the
training window. The threshold is recalculated inside every chronological fold. Missing source
coverage is never converted to zero.

## Permitted inputs

Only observed or genuinely forecast public data may enter a production feature snapshot:

- SMARD actual/forecast load, wind and solar, and day-ahead price;
- published redispatch events available before the issue time;
- ENTSO-E load, generation and cross-border schedules/flows;
- DWD forecasts captured before the delivery period.

Synthetic, reconstructed-network, SimBench, surrogate, scenario, and future-revised values are
rejected. Derived quantities such as net load are allowed when every parent value is permitted and
its lineage is retained.

## Validation and promotion

Validation uses expanding-window, rolling-origin folds only. The candidate is compared with
seasonal-frequency, persistence, and logistic-regression baselines. Promotion requires at least
three folds, at least 180 training days per fold, no leakage finding, source completeness of at
least 95%, and improvement over the best baseline in both Brier score and log loss. Quantile
coverage and pinball loss are reported separately.

Models are immutable. Only a model explicitly marked `accepted` may publish a production
prediction. Predictions become unavailable when mandatory inputs are stale or a drift/freshness
gate fails.

## Product interpretation

Constraints shows the forecast as national/regional operating context. Power Finder attaches the
same regional outlook to candidate investigation, without changing Investigation Fit or claiming
free MW. Site-specific capacity still requires network topology, ratings, states, contingency and
operator evidence.
