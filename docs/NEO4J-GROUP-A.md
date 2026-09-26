# Neo4j Group A — governed topology engine

Group A turns Neo4j into a private, versioned topology-analysis component. It does **not** calculate or publish available grid capacity.

## A1 — typed CGMES boundary

`graph/cgmes.py` reads RDF/XML files or ZIP packages, requires EQ, SSH, TP and SV profiles, merges entities by mRID, validates references, and produces a file/hash manifest. `cgmes_projection.py` creates a lossless graph projection and a round-trip report. This is a deliberately bounded adapter, not a claim of complete IEC CGMES conformance; operator packages still require schema/profile conformance testing.

## A2 — immutable topology states

Switch positions and unavailable assets create a new content-addressed projection. The source projection is unchanged and a deterministic edge diff is retained. A state is an investigation scenario, not proof of the real switching state.

## A3 — explainable weights

`topology-investigation-cost-v1` combines distance, voltage transitions, missing parameters, evidence gaps, radial/bridge exposure, operator boundaries and planning constraints. Every component is returned. The result means relative investigation cost; it must never be labelled capacity, connection probability or delivery time.

## A4 — governed GDS execution

The registry permits Dijkstra, Yen, A*, weakly connected components, bridges, articulation points and betweenness only for their documented topology-screening uses. Each run records algorithm/version, configuration and result hashes, runtime, approved use and prohibited interpretations. GDS projections are ephemeral and must be dropped after a job. Memory estimation precedes production projection.

## Data and sovereignty

CGMES packages, topology states and algorithm audit records use RLS-enabled tables with all public, anonymous and authenticated privileges revoked; only `service_role` receives access. Neo4j is deployable inside the operator-approved German/EU boundary. Data residency is a deployment control and is not guaranteed merely by using Neo4j.

## Promotion gate

Before a pilot result advances beyond `operator_model_unvalidated`, require operator-supplied model authority, profile validation, reconciliation to the operator study tool, approved normal/outage states and written review. Physics remains in pandapower/validated operator tools; graph results reduce and explain the search space.
