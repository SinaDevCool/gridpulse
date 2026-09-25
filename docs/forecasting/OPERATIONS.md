# Forecast operations

## Storage

- Normalized observations, targets, point-in-time feature snapshots, model registry records,
  backtest folds, predictions and monitoring events live in Supabase.
- Raw immutable downloads and `joblib` model artifacts belong in private object storage. Their URI
  and SHA-256 are recorded in the database. They must not be committed to Git or served publicly.
- A developer machine holds only temporary work files. OneDrive may be used as a private backup,
  but it is not a production runtime dependency.

## Release sequence

1. Apply `20260925010000_real_grid_stress_forecasting.sql`.
2. Use the existing canonical SMARD and redispatch parsers, the forecasting adapters, and the
   ENTSO-E/DWD capture functions to publish normalized real observations.
3. Materialize training rows only from point-in-time snapshots. Rows with incomplete source days
   remain missing; do not replace them with zeros or synthetic values.
4. Run `grid-data backtest-grid-stress --input rows.json --output backtest.json`.
5. Run `grid-data train-grid-stress --input rows.json --artifact model.joblib --manifest model.json`.
   This command fails unless every promotion gate passes.
6. Upload the immutable artifact to private object storage, create the matching accepted model
   registry row, and retire the previous champion in one controlled release transaction.
7. Build tomorrow's snapshot from values known at the issue time and run
   `grid-data infer-grid-stress --snapshot snapshot.json --artifact model.joblib --manifest model.json --output forecast.json`.
8. Publish through `ForecastStore`. The public API returns only predictions joined to an accepted
   model. If inputs are stale, do not publish; record a failed freshness monitoring event.

## Scheduling

Ingestion should run after each upstream publication cycle. Day-ahead inference should run after
the required SMARD/load-forecast inputs arrive and before the configured market-day cutoff.
Backtesting/retraining is monthly or on material drift, never automatically promoted. Alerts fire
for missing mandatory sources, PSI above the approved threshold, calibration deterioration, or a
failed inference. An unavailable card is the correct product behavior when a gate fails.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` and `ENTSOE_SECURITY_TOKEN` are server-only secrets. Never expose them
through Vite variables or browser bundles. The frontend uses only the public forecast RPC.
