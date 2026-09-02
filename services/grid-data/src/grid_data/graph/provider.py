from __future__ import annotations

import os
from typing import Any, Protocol

from .analysis import analyze_topology, candidate_pathways
from .contracts import GraphProjection
from .neo4j_store import Neo4jGraphStore


class TopologyProvider(Protocol):
    name: str

    def inspect(
        self, projection: GraphProjection, *, source_bus: str, target_buses: list[str], k: int = 3
    ) -> tuple[dict[str, Any], dict[str, Any]]: ...


class InMemoryTopologyProvider:
    name = "deterministic_in_memory"

    def inspect(
        self, projection: GraphProjection, *, source_bus: str, target_buses: list[str], k: int = 3
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        audit = analyze_topology(projection)
        pathways = candidate_pathways(projection, source_bus, target_buses, k=k)
        audit["topology_provider"] = self.name
        pathways["topology_provider"] = self.name
        return audit, pathways


class Neo4jTopologyProvider:
    """Execute bounded topology discovery through Neo4j GDS and return the shared UI contract."""

    name = "neo4j_gds"

    def __init__(self, store: Neo4jGraphStore | None = None) -> None:
        self._store = store or Neo4jGraphStore()
        self._owns_store = store is None

    def inspect(
        self, projection: GraphProjection, *, source_bus: str, target_buses: list[str], k: int = 3
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        model_key = f"{projection.model_id}@{projection.model_version}"
        estimated_bytes = len(projection.nodes) * 512 + len(projection.edges) * 384
        maximum_bytes = int(os.getenv("GRIDPULSE_GDS_MAX_ESTIMATED_BYTES", "536870912"))
        if estimated_bytes > maximum_bytes:
            raise MemoryError(
                f"GDS projection estimate {estimated_bytes} exceeds policy limit {maximum_bytes}."
            )
        kinds = {node.external_id: node.kind for node in projection.nodes}
        self._store.publish(projection)
        graph_name = self._store.project_gds(projection)
        try:
            topology = self._store.gds_topology_metrics(graph_name)
            rows: list[dict[str, Any]] = []
            for target_bus in target_buses:
                for result in self._store.gds_yens(
                    graph_name,
                    model_key=model_key,
                    source_id=source_bus,
                    target_id=target_bus,
                    k=k,
                ):
                    ordered = result["asset_ids"]
                    rows.append(
                        {
                            "target_bus": target_bus,
                            "bus_ids": [item for item in ordered if kinds.get(item) == "Bus"],
                            "asset_ids": [
                                item
                                for item in ordered
                                if kinds.get(item) in {"Line", "Transformer"}
                            ],
                            "total_graph_cost": round(float(result["total_graph_cost"]), 6),
                        }
                    )
            rows = sorted(rows, key=lambda row: (row["total_graph_cost"], row["target_bus"]))[:k]
            for rank, row in enumerate(rows, start=1):
                row["rank"] = rank
            audit = analyze_topology(projection)
            audit.update(
                {
                    "topology_provider": self.name,
                    "gds_memory_estimate_bytes": estimated_bytes,
                    "gds_connected_components": topology["connected_components"],
                    "gds_bridges": topology["bridges"],
                    "gds_articulation_assets": topology["articulation_assets"],
                    "gds_topological_centrality": topology["topological_centrality"],
                }
            )
            pathways = {
                "schema_version": "gridpulse-topology-pathways-v1",
                "model_version": projection.model_version,
                "source_bus": source_bus,
                "pathways": rows,
                "algorithm": "neo4j_gds_yens",
                "topology_provider": self.name,
                **projection.safety,
            }
            return audit, pathways
        finally:
            self._store.drop_gds(graph_name)
            if self._owns_store:
                self._store.close()


def configured_topology_provider() -> TopologyProvider:
    requested = os.getenv("GRIDPULSE_TOPOLOGY_PROVIDER", "auto").strip().lower()
    if requested == "memory":
        return InMemoryTopologyProvider()
    if requested == "neo4j" or (requested == "auto" and os.getenv("NEO4J_PASSWORD")):
        return Neo4jTopologyProvider()
    if requested not in {"auto", "memory", "neo4j"}:
        raise ValueError("GRIDPULSE_TOPOLOGY_PROVIDER must be auto, memory or neo4j.")
    return InMemoryTopologyProvider()
