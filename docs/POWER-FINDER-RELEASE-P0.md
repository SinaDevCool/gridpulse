# Power Finder Release P0 — provenance-first pilot foundation

Release P0 defines one replaceable contract for synthetic demonstration data and future
operator-supplied pilot data. It does not publish or claim capacity.

## Implemented boundary

- Strict contracts cover network models, hourly observations, connection queues,
  reinforcements, contingencies, security criteria and provenance.
- `SyntheticPilotDataProvider` loads the checked-in Brandenburg-like fixture.
- `OperatorPilotDataProvider` accepts the identical package shape but requires
  `operator_supplied` evidence and an operator validation class.
- Every declared artifact is SHA-256 checked before parsing.
- Unknown fields fail validation so schema drift cannot be silently ignored.
- Synthetic data can only use `synthetic_demonstration`; Python and database gates reject
  promotion to any operator validation class.

## Synthetic fixture

`services/grid-data/fixtures/synthetic-pilot` is a fictional 110/20 kV network and is not
geographically linked to a public Finder node. It includes a deterministic three-year hourly
SCADA-like series, nodal queue entries, a reinforcement, mandatory mock contingencies and mock
security criteria. Every synthetic identifier uses the `synthetic-` prefix.

The fixture exists to exercise the pilot pipeline until a DSO/TSO package is available. Replace
it through the `operator_pilot_data_v1` contract; do not edit it to resemble a real substation.

## Validate a package

```powershell
$env:PYTHONPATH = (Resolve-Path "services/grid-data/src").Path
python -m grid_data.cli validate-pilot-package `
  --kind synthetic `
  --input services/grid-data/fixtures/synthetic-pilot
```

Use `--kind operator` only for a controlled operator package containing a source reference and
data-use basis. Import alone produces `operator_model_unvalidated`, never confirmed capacity.

## Database privacy

Migration `20260808500000_release_p0_pilot_data_foundation.sql` creates private service-role-only
registries for datasets, artifacts, model versions, validation events and replacement audits.
There are no anonymous or authenticated-client grants.

## Release P0 completion criteria

1. Both providers implement the same canonical bundle.
2. Synthetic fixtures cannot be promoted.
3. Missing provenance, checksum changes and unknown fields fail closed.
4. Three complete synthetic hourly years load deterministically.
5. Operator data can replace the fixture without changing solver contracts.
