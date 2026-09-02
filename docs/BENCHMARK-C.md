# Benchmark C — operator-reference and measurement reconciliation

## Objective

Benchmark C is the first validation gate that requires evidence from outside GridPulse's synthetic
and open-model environment. It compares time-aligned simulated electrical quantities with an
operator-supplied solved case or measurement package.

The benchmark deliberately separates two decisions:

- `numerical_reconciliation_passed`: the supplied series meet declared engineering thresholds;
- `operator_validation_passed`: numerical thresholds and every evidence/authority gate pass.

A synthetic fixture can prove that the software and thresholds operate correctly, but it can never
set the second decision to true.

## Required real-pilot inputs

The CLI accepts three JSON files together:

1. `--observed`: timestamped operator observations with element ID, active power, reactive power,
   voltage, loading and quality flag;
2. `--simulated`: independently produced values for the same timestamp/element keys;
3. `--evidence`: provenance and authorization manifest.

The evidence manifest must establish:

- `evidence_origin: operator_supplied`;
- `model_format: cgmes_2.4.15` or `cgmes_3.0`;
- `independently_converted: true`;
- `operator_authorized: true`;
- `permission_to_use: true`;
- valid SHA-256 identifiers for the CGMES package and reference results.
- an Ed25519 signature over the canonical evidence manifest, verified using a separately supplied
  trusted operator/governance public key.

Missing or partial inputs fail closed. Supplying fields with plausible names is not operator review;
the files and hashes must be governed through the private pilot workflow before any promotion.

## Numerical procedure

Only observations marked `good` or `substituted` enter reconciliation. Rows are joined by exact UTC
timestamp and model element ID. The report calculates coverage plus mean absolute error for active
power, reactive power, voltage and loading, and active-power RMSE.

Default acceptance thresholds are:

- at least four observations for the bundled rehearsal;
- at least 95% matched-pair coverage;
- at least 95% coverage independently for P, Q, voltage and loading;
- active-power MAE no greater than 0.5 MW;
- reactive-power MAE no greater than 0.25 MVAr;
- voltage MAE no greater than 0.01 pu;
- loading MAE no greater than 1.0 percentage point.

For a real pilot, `--minimum-observations` should be set by the approved validation protocol before
results are examined. Benchmark C does not infer a utility-grade sampling duration on its own.

## Bundled rehearsal

Run from the repository root:

```powershell
npm run grid:benchmark:c
```

This uses a small deterministic synthetic observed/simulated pair and writes
`output/benchmark-c.json`. Expected interpretation:

- numerical reconciliation: passed;
- benchmark execution: passed;
- operator validation: not passed;
- validation class: `synthetic_demonstration`;
- capacity claim/display: false.

## Real-input invocation

```powershell
$env:PYTHONPATH=(Resolve-Path 'services/grid-data/src').Path
python -m grid_data.cli validate-benchmark-c `
  --observed D:\pilot\observed.json `
  --simulated D:\pilot\operator-reference.json `
  --evidence D:\pilot\evidence-manifest.json `
  --trusted-public-key D:\pilot\trusted-operator-key.pem `
  --minimum-observations 1000 `
  --minimum-coverage 0.95 `
  --output D:\pilot\benchmark-c.json
```

When external files are supplied, the command exits non-zero unless both numerical and operator
evidence gates pass.

## What Benchmark C still does not prove

Passing supports promotion only to `operator_model_reconciled`. It does not itself provide operator
review, a connection offer, a capacity reservation, or permission to publish location capacity.
Short-circuit duty, protection coordination, harmonics, dynamics, connection queue, switching
policy and complete contingency policy remain separate governed evidence requirements.
