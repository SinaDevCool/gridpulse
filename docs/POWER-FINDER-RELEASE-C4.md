# Power Finder Release C4 — Operator pilot

Release C4 provides the controlled path from an open benchmark to a real,
operator-reviewed grid model. It does not claim that GridPulse currently has an
operator partner, a real pilot substation or operator-confirmed capacity.

## Implemented technical workflow

- Private `operator-data-room` object bucket with project/role-scoped access.
- Versioned packages for CGMES, SCADA, ratings, contingency lists and agreements.
- Per-file and package SHA-256 provenance.
- Existing CGMES 2.4.15/3.0 conversion, topology checks and AC convergence gate.
- UTC SCADA ingestion with quality flags, duplicate rejection, sanity limits and
  maximum bad-quality threshold.
- Measurement/model reconciliation using coverage, active-power MAE/RMSE and
  voltage MAE gates.
- Explicit promotion ladder: unvalidated → reconciled → reviewed → confirmed.
- Authenticated operator review workspace and signed-review records.
- Hash-chained, append-only audit events.
- Written data-use and capacity-representation agreement registry.
- Fail-closed confirmation RPC: confirmation requires a real-pilot marker,
  passing reconciliation, operator review and signed representation agreement.

## Free data used for validation

The engineering pipeline may be tested with SimBench and public ENTSO-E CGMES
test models. SMARD, DWD and MaStR remain contextual inputs from C2/C3. None of
these public sources replaces substation topology, SCADA, equipment ratings,
connection queues or an operator-approved contingency list.

## External gates that software cannot complete

- A German DSO/TSO must identify and authorise a bounded pilot substation.
- The operator must provide the model and measurement package under an agreed
  reuse/security basis.
- GridPulse and the operator must sign data-use, pilot-scope and capacity-
  representation agreements.
- An authorised operator reviewer must approve or confirm the result.

Until those gates are satisfied, C4 remains `operator_model_unvalidated` or
`operator_model_reconciled`; it cannot be published as confirmed capacity.
