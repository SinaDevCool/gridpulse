# Benchmark D — capacity-outcome backtest

## Objective

Benchmark D evaluates the final MW outputs rather than only power-flow states. It compares
GridPulse-calculated N-0 and firm import limits against independently derived, operator-approved
technical-study outcomes for the same case and connection node.

The principal safety question is asymmetric: did GridPulse overstate capacity? An unsafe
overstatement cannot be cancelled by conservative results elsewhere in the dataset.

## Input contract

Real execution requires three JSON documents and a separate trust anchor:

- predictions: GridPulse N-0/firm MW and binding constraint per case/node;
- references: independently derived operator N-0/firm MW and binding constraint for identical keys;
- evidence: outcome authority, permissions and exact content hashes;
- trusted public key: the Ed25519 key used to authenticate the evidence manifest.

Prediction/reference rows require:

```json
{
  "case_id": "winter-peak-n-1",
  "node_id": "operator-node-id",
  "n0_import_mw": 12.5,
  "firm_import_mw": 8.0,
  "binding_constraint": "transformer_thermal_loading"
}
```

Duplicate case/node keys, negative or non-finite MW, missing fields, incomplete input bundles and
hash mismatches fail closed.

## Metrics

N-0 and firm capacity are evaluated separately using:

- mean absolute error;
- P95 absolute error;
- signed bias;
- maximum overstatement;
- unsafe-overstatement count and rate.

The benchmark also records reference coverage and binding-constraint accuracy. Unsafe cases are
listed individually as `case_id::node_id` so they cannot disappear inside aggregate statistics.

## Default acceptance policy

- at least four cases for the bundled rehearsal;
- at least 95% reference coverage;
- N-0 and firm MAE no greater than 0.25 MW;
- N-0 and firm P95 error no greater than 0.5 MW;
- zero cases exceeding the 0.25 MW unsafe-overstatement tolerance;
- binding-constraint accuracy at least 95%.

These defaults demonstrate the gate. A real pilot protocol must pre-register sample size,
stratification, operating cases and thresholds before examining holdout outcomes.

## Operator evidence gate

`operator_outcome_validation_passed` additionally requires:

- operator-supplied origin;
- outcome type `technical_study`, `capacity_statement` or `connection_offer`;
- an independently derived reference;
- operator approval and permission to use;
- prediction and reference hashes matching the exact inputs;
- a valid Ed25519 signature verified against the separately supplied trusted key.

Passing assigns at most `operator_reviewed`. Benchmark D never sets `operator_confirmed`,
`capacity_claim=true` or `display_as_capacity=true`. Formal publication remains controlled by the
operator-review, candidate-to-model-bus, agreement and database promotion gates.

## Synthetic rehearsal

```powershell
npm run grid:benchmark:d
```

This writes `output/benchmark-d.json`. It is expected to pass the numerical backtest and fail the
operator-outcome gate because its four outcomes are deterministic synthetic fixtures.

## Real invocation

```powershell
$env:PYTHONPATH=(Resolve-Path 'services/grid-data/src').Path
python -m grid_data.cli validate-benchmark-d `
  --predictions D:\pilot\gridpulse-predictions.json `
  --references D:\pilot\operator-outcomes.json `
  --evidence D:\pilot\outcome-evidence.json `
  --trusted-public-key D:\pilot\trusted-operator-key.pem `
  --minimum-cases 50 `
  --minimum-coverage 0.95 `
  --output D:\pilot\benchmark-d.json
```

For supplied outcomes, the command exits non-zero unless both the numerical and signed operator
evidence gates pass.

## Scientific limitations

A retrospective pass on a small or selected sample does not establish general performance. A
credible claim needs prospective holdout sites, representative voltage levels and seasons, normal
and contingency states, documented operator study policy, and confidence intervals. Connection
offers can also include commercial, queue, reinforcement and contractual considerations that are
not pure free-capacity labels.
