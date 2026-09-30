# GridPulse private Neo4j topology engine

Neo4j is a private topology-selection layer. PostgreSQL/PostGIS remains authoritative for spatial,
evidence and governance records. Pandapower remains authoritative for electrical feasibility.
Neo4j results are never available MW or operator confirmation.

## Local runtime

Set a local-only `NEO4J_AUTH` value and start the pinned Neo4j 5.26 container with GDS:

```powershell
$env:NEO4J_AUTH='neo4j/<strong-local-password>'
docker compose -f compose.neo4j.yml up -d
```

Set `NEO4J_URI`, `NEO4J_DATABASE`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in the analytics
runtime. Validate the live projection with `npm run grid:validate:neo4j`.

## Implemented boundaries

- Deterministic graph projections use stable model-scoped external identifiers and checksums.
- Buses and equipment remain separate graph entities; terminal relationships preserve topology.
- Lines and transformers retain the parameters required to reconstruct the physics model.
- Topology audits detect components, orphans, malformed equipment, missing parameters, bridges,
  and articulation buses.
- Candidate analysis returns multiple deterministic simple paths and explicit graph costs, never MW.
- Scenario selection always includes operator-mandated contingencies and fails when the budget would
  exclude them.
- Graph-selected scenarios are compared with the full physics set before prioritisation can be
  considered safe.
- Private job and database boundaries prevent anonymous access to topology studies.
- Operator models require explicit topology-processing permission. Permission for derived metrics
  and model training are independent.

## Production requirements

Use an operator-approved EU deployment, TLS for Bolt, encrypted disks/backups, private networking,
least-privilege service identities, security/query logging, per-operator isolation and tested
deletion/restore procedures. Community local development is not a sovereignty certification.

## Validation ladder

Synthetic and SimBench models validate software behavior only. An operator model must be licensed,
reconciled and reviewed. Graph selection proposes; pandapower verifies; the operator confirms.
