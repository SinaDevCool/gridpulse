from __future__ import annotations

from collections import deque
from typing import Any

MODEL_VERSION = "reference-topology-v1"


def screen_reference_topology(payload: dict[str, Any]) -> dict[str, Any]:
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    source_id = str(payload.get("source_node_id", ""))
    target_id = str(payload.get("target_node_id", ""))
    node_by_id = {str(node["id"]): node for node in nodes}
    if source_id not in node_by_id or target_id not in node_by_id:
        raise ValueError("Source and target nodes must exist in the model.")

    adjacency: dict[str, list[tuple[str, float]]] = {node_id: [] for node_id in node_by_id}
    rejected_edges = 0
    for edge in edges:
        start, end = str(edge.get("from", "")), str(edge.get("to", ""))
        if start not in adjacency or end not in adjacency:
            rejected_edges += 1
            continue
        length_km = max(0.0, float(edge.get("length_km", 0)))
        adjacency[start].append((end, length_km))
        adjacency[end].append((start, length_km))

    queue = deque([(source_id, [source_id], 0.0)])
    visited = {source_id}
    path: list[str] | None = None
    path_length_km = 0.0
    while queue:
        current, candidate_path, distance = queue.popleft()
        if current == target_id:
            path, path_length_km = candidate_path, distance
            break
        for neighbor, edge_length in adjacency[current]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, [*candidate_path, neighbor], distance + edge_length))

    source_voltage = node_by_id[source_id].get("voltage_kv")
    target_voltage = node_by_id[target_id].get("voltage_kv")
    completeness = (
        sum(1 for node in nodes if node.get("voltage_kv") is not None) / len(nodes) if nodes else 0
    )
    return {
        "methodology_version": MODEL_VERSION,
        "classification": "topology_screening_only",
        "connected": path is not None,
        "path_node_ids": path or [],
        "path_length_km": round(path_length_km, 3) if path else None,
        "voltage_compatible": (
            source_voltage == target_voltage
            if source_voltage is not None and target_voltage is not None
            else None
        ),
        "topology_completeness": round(completeness, 4),
        "rejected_edge_count": rejected_edges,
        "lineage": payload.get("lineage", {}),
        "limitations": [
            "No impedance, loading, fault-level, protection, voltage-drop or contingency study.",
            "Connectivity does not establish hosting capacity or a feasible connection point.",
            "The responsible network operator remains controlling.",
        ],
    }
