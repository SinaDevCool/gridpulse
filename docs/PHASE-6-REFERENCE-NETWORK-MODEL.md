# Phase 6 — governed reference network model

Phase 6 reuses the authenticated analytics job boundary and normalized grid
features. The `reference_topology` job records its input lineage and produces an
inspectable connectivity path, path length, voltage compatibility, topology
completeness, and rejected-edge count.

The result is deliberately classified as `topology_screening_only`. It performs
no impedance, loading, voltage-drop, fault-level, protection, power-flow, or N-1
contingency study and never represents hosting capacity or a feasible connection
point. Utility-supplied models and validation remain required before technical
network conclusions can be made.
