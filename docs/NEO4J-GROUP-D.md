# Neo4j Group D — production and sovereignty controls

Group D makes the private graph/physics system operable as a controlled pilot service. It does not add public capacity claims.

## D1 — temporal history

Every topology version has a timezone-aware, non-overlapping validity interval. The event ledger requires contiguous sequence numbers and unique source hashes. Point-in-time lookup returns exactly one snapshot or none; ambiguous history is rejected.

## D2 — atomic version publication

`incremental.py` creates a deterministic delta with node/relationship upserts and deletions, expected and next projection hashes, and rollback identity. `publish_delta_snapshot` checks the current base hash inside a Neo4j write transaction and materialises a complete immutable next-version snapshot atomically. Full immutable materialisation is intentional: it keeps rollback and audit reproducible while the delta documents what changed.

## D3 — operational quality and drift

The quality gate evaluates electrical-parameter completeness, orphan ratio, voltage MAE, active-power MAE and observation coverage against a versioned policy. Missing observations fail closed. A failed run invalidates attached physics results until reconciliation and review are repeated.

## D4 — sovereign workspaces

Workspace policy restricts processing region, allowed purpose, retention, model-training permission and raw export. Raw operator topology, equipment, SCADA and observation fields are removed from exports unless the workspace agreement explicitly permits them. These software controls support—but do not alone certify—GDPR, German critical-infrastructure or operator contractual compliance.

## Operations

All Group D ledgers are RLS-enabled and inaccessible to anonymous or normal authenticated clients. Production deployment still requires EU/German hosting decisions, encrypted backup/restore drills, key rotation, incident response, deletion verification and operator-approved access roles.
