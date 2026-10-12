# Neo4j Group B — permutation and portfolio intelligence

Group B uses the private topology graph to reduce and explain the physics-study search space. The graph never replaces AC power flow, contingency checks or operator approval.

## B1 — bounded state spaces

`state_space.py` creates deterministic Cartesian products over approved scenario axes. It rejects duplicate/empty axes and refuses packages larger than the configured ceiling before materialising them. Every state and complete state space is content-addressed. Supported axes map directly to the immutable `ScenarioDefinition` contract.

## B2 — validated reduction

Graph criticality and candidate pathways prioritise scenarios. The selected set is then compared with the full physics set. Promotion fails closed unless infeasible-case recall, binding-constraint recall and mandatory-scenario coverage meet policy. The full set remains authoritative whenever the gate fails.

## B3 — portfolio topology

Candidate pathways are compared pairwise for shared upstream assets, Jaccard topology overlap and path diversity. These values identify correlated investigation exposure; they do not quantify simultaneous connectable MW.

## B4 — lineage and invalidation

Model-version diffs identify added, removed and changed nodes/relationships and their directly affected assets. Any electrical/topology change invalidates dependent studies. Reproducible bundles bind source, projection, topology state, algorithm results and physics-result hashes.

## Pilot promotion requirements

Group B can be used internally with synthetic or public-screening models. A pilot claim requires an authorised operator model, complete mandatory contingency list, full-set benchmark evidence, reconciled physics outcomes and operator review. Search reduction is an efficiency mechanism, never a relaxation of German operator security criteria.
