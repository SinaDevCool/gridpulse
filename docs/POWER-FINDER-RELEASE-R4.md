# Power Finder Release 4 — operator-pilot replacement rehearsal

Release 4 proves that GridPulse can replace the synthetic fixture with a governed operator model
without allowing graph analysis, synthetic results or caller assertions to become public capacity.

## Delivered

- The acceptance benchmark exercises base operating cases and every fixture contingency through the
  graph-guided selector and authoritative Pandapower solver.
- All 16 repository gates are derived from executed evidence. Mandatory recall, constraint recall,
  solver coverage, false-safe outcomes and public-output separation are no longer hard-coded passes.
- The qualification reduces ten physics cases to six while retaining 100% infeasible and binding-
  constraint recall and zero false-safe cases.
- Duplicate scenarios, invalid budgets, unbound promoted policies and solver output outside the
  selected set fail closed.
- Public API callers cannot provide a workspace ID or invoke promoted mode. Studies are initially
  private and unlinked.
- A reviewer-only database workflow attaches studies to a real operator workspace after checking a
  current signed topology-processing agreement.
- Promotion requires a passed reconciliation referenced by the operator review, complete safety
  gates and current data-use permission. Operator-confirmed status additionally requires a confirmed
  review, workspace confirmation and signed capacity-representation permission.
- The public artifact exposes aggregate governance and reproducibility hashes only. Operator data and
  individual physics outcomes remain private, and graph results never colour public capacity.

## Acceptance command

```powershell
npm run grid:validate:synthetic-pilot
```

The bundled result remains a synthetic replacement rehearsal. It does not represent an operator
pilot, capacity availability, connection probability, offer or delivery date.
