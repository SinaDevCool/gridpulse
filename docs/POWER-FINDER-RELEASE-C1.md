# Power Finder Release C1 — real solver foundation

Release C1 provides a versioned, fail-closed AC network-study pipeline. It proves solver and
persistence capability on open German benchmark data. It does **not** establish actual capacity at
any mapped Brandenburg node.

## Implemented boundary

- `PandapowerProvider` constructs networks only from explicit bus, line, transformer, load,
  generator and switch parameters.
- Newton–Raphson AC load flow checks convergence, unsupplied load buses, voltage bounds, line
  loading and transformer loading.
- Import capacity uses a bounded binary search and records the first binding constraint.
- Reviewed line or transformer outage cases can be evaluated individually. A missing contingency
  list is reported; it is never silently replaced with invented outages.
- Results carry model ID/version, solver/version, source URL, licence, validation class, study year,
  assumptions and limitations.
- The authenticated Python job API accepts only `synthetic_demonstration` or
  `operator_model_unvalidated`; callers cannot self-promote results to operator-confirmed.

## Open benchmark validation

The reproducible validation command imports SimBench `1-MV-urban--0-sw` (ODbL), preserves its
electrical parameters and switching state, runs the AC solver and writes
`public/power-finder/c1-benchmark-validation.json`.

```powershell
npm run grid:validate:c1
```

The checked-in run converged and found a 5.812 MW incremental import boundary at the chosen
benchmark bus, limited by line thermal loading. This number belongs only to that representative
network and connection bus. It is neither Brandenburg headroom nor a connection offer.

## CGMES import

The importer supports CGMES 2.4.15 and 3.0 via pandapower's official converter. It requires EQ,
SSH, TP and SV profiles, hashes the full input package, requires a declared HTTPS source and reuse
basis, retains CIM `origin_id` fields, requires a convergent base case, and writes an immutable
pandapower JSON model plus manifest.

```powershell
python -m grid_data.cli import-cgmes `
  --input pilot_EQ.xml --input pilot_SSH.xml --input pilot_TP.xml --input pilot_SV.xml `
  --output-model D:\grid-data\pilot-model.json `
  --output-manifest D:\grid-data\pilot-manifest.json `
  --model-key operator-pilot-01 --model-version 2026-01 `
  --source-url https://operator.example/model-register `
  --licence "pilot data agreement" --cgmes-version 3.0
```

Imported CGMES models remain `operator_model_unvalidated` until measurement reconciliation and
operator review are completed.

## Database and web app

The C1 migrations create:

- `grid_model_versions`
- `grid_model_connection_points`
- `network_study_runs`
- `power_finder_public_c1_study(node_record_id)`

All tables have RLS enabled and no browser table grants. The public RPC exposes a node result only
when the model-to-node match is reviewed and the run is `operator_reviewed` or
`operator_confirmed`. The benchmark record is returned separately with its synthetic label.

The Power Finder right panel now shows “Electrical Model Status.” It distinguishes:

- no reviewed electrical model linked to this node;
- open benchmark solver validation; and
- a reviewed node result, if one is later published.

## Validation ladder

`public_screening` → `synthetic_demonstration` → `operator_model_unvalidated` →
`operator_model_reconciled` → `operator_reviewed` → `operator_confirmed`

Only the last class can be described as confirmed connection capacity. C1 implements the software
foundation; real node capacity still depends on operator model data, operating cases, security
criteria and review.

## Source references

- SimBench: https://simbench.de/en/download/
- pandapower CGMES converter: https://pandapower.readthedocs.io/en/stable/converter/cgmes.html
- ENTSO-E CGMES/CIM: https://www.entsoe.eu/digital/common-information-model/cim-for-grid-models-exchange/
