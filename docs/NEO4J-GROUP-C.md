# Neo4j Group C — graph-to-physics governance

Group C connects the private topology and permutation layers to verified electrical studies. Neo4j organises cases, lineage and results; pandapower or an operator-approved study tool remains the electrical authority.

## C1 — graph-to-physics compilation

`physics_compiler.py` reconstructs a deterministic `NetworkModelInput` from a versioned projection. Compilation stops if the connection bus is absent, equipment terminals are malformed, the network is disconnected or required line/transformer parameters are missing. The manifest binds the compiled case to the projection hash.

## C2 — contingency and restoration planning

`contingency_planner.py` creates the normal case, every declared contingency and bounded switch-restoration candidates. Missing mandatory contingencies and oversized expansions fail before solver execution. Restoration candidates are advisory and require operator switching approval.

## C3 — verified result graph

`physics_results.py` accepts only `physics_verified` outcomes. Asset-resolved binding constraints create `BOUND_BY` relationships; solver-level labels that are not asset identifiers remain explicitly unresolved instead of being falsely linked. Neo4j stores result nodes separately from topology assets. A projection-hash mismatch marks results stale and prevents reuse.

## C4 — operator promotion

`promotion.py` validates content hashes, timezone-aware review time, reconciliation, mandatory-case recall, binding-constraint recall and operator signature. `operator_confirmed` cannot be created without every check. Approval records establish evidence state; they do not substitute for the operator's formal connection offer or contract.

## German pilot boundary

The operator must supply the authorised model, ratings, switching states, mandatory security cases and review signature. Short-circuit, protection, harmonics, stability and formal connection design remain separate studies unless explicitly included in the operator-approved workflow.
