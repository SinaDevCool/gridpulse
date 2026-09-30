from __future__ import annotations

from dataclasses import asdict
from typing import Any

from grid_data.p0_foundation import canonical_hash

from .contracts import GraphProjection


def build_projection_delta(before: GraphProjection, after: GraphProjection) -> dict[str, Any]:
    if before.model_id != after.model_id:
        raise ValueError("Projection deltas cannot cross model identities.")
    old_nodes = {row.external_id: row for row in before.nodes}
    new_nodes = {row.external_id: row for row in after.nodes}
    old_edges = {row.external_id: row for row in before.edges}
    new_edges = {row.external_id: row for row in after.edges}
    node_upserts = [
        asdict(new_nodes[key])
        for key in sorted(new_nodes)
        if key not in old_nodes or new_nodes[key] != old_nodes[key]
    ]
    edge_upserts = [
        asdict(new_edges[key])
        for key in sorted(new_edges)
        if key not in old_edges or new_edges[key] != old_edges[key]
    ]
    payload = {
        "model_id": before.model_id,
        "expected_projection_sha256": before.projection_sha256,
        "next_projection_sha256": after.projection_sha256,
        "next_model_version": after.model_version,
        "node_upserts": node_upserts,
        "node_deletes": sorted(old_nodes.keys() - new_nodes.keys()),
        "edge_upserts": edge_upserts,
        "edge_deletes": sorted(old_edges.keys() - new_edges.keys()),
    }
    return {
        **payload,
        "delta_sha256": canonical_hash(payload),
        "rollback": {
            "projection_sha256": before.projection_sha256,
            "model_version": before.model_version,
        },
        "display_as_capacity": False,
    }


def validate_delta(delta: dict[str, Any], current_projection_sha256: str) -> None:
    if delta["expected_projection_sha256"] != current_projection_sha256:
        raise RuntimeError("Projection changed since the delta was prepared; recompute it.")
    material = {
        key: value
        for key, value in delta.items()
        if key not in {"delta_sha256", "rollback", "display_as_capacity"}
    }
    if canonical_hash(material) != delta["delta_sha256"]:
        raise ValueError("Projection delta hash is invalid.")
