from __future__ import annotations

from dataclasses import asdict
from typing import Any

from grid_data.p0_foundation import canonical_hash

from .contracts import GraphProjection


def projection_change_impact(before: GraphProjection, after: GraphProjection) -> dict[str, Any]:
    old_nodes = {node.external_id: node for node in before.nodes}
    new_nodes = {node.external_id: node for node in after.nodes}
    old_edges = {edge.external_id: edge for edge in before.edges}
    new_edges = {edge.external_id: edge for edge in after.edges}
    changed_nodes = sorted(
        key
        for key in old_nodes.keys() & new_nodes.keys()
        if asdict(old_nodes[key]) != asdict(new_nodes[key])
    )
    changed_edges = sorted(
        key
        for key in old_edges.keys() & new_edges.keys()
        if asdict(old_edges[key]) != asdict(new_edges[key])
    )
    affected = set(changed_nodes)
    for key in set(old_edges) ^ set(new_edges) | set(changed_edges):
        edge = new_edges.get(key) or old_edges[key]
        affected.update((edge.source, edge.target))
    payload = {
        "added_nodes": sorted(new_nodes.keys() - old_nodes.keys()),
        "removed_nodes": sorted(old_nodes.keys() - new_nodes.keys()),
        "changed_nodes": changed_nodes,
        "added_edges": sorted(new_edges.keys() - old_edges.keys()),
        "removed_edges": sorted(old_edges.keys() - new_edges.keys()),
        "changed_edges": changed_edges,
        "affected_asset_ids": sorted(affected),
    }
    return {
        **payload,
        "impact_sha256": canonical_hash(payload),
        "requires_study_invalidation": any(
            payload[key]
            for key in (
                "added_nodes",
                "removed_nodes",
                "changed_nodes",
                "added_edges",
                "removed_edges",
                "changed_edges",
            )
        ),
        "display_as_capacity": False,
    }


def reproducible_study_bundle(
    *,
    projection: GraphProjection,
    state_sha256: str,
    algorithm_runs: list[dict[str, Any]],
    physics_result_sha256: str | None,
) -> dict[str, Any]:
    payload = {
        "model_id": projection.model_id,
        "model_version": projection.model_version,
        "source_sha256": projection.source_sha256,
        "projection_sha256": projection.projection_sha256,
        "state_sha256": state_sha256,
        "algorithm_result_sha256s": sorted(run["result_sha256"] for run in algorithm_runs),
        "physics_result_sha256": physics_result_sha256,
    }
    return {
        **payload,
        "bundle_sha256": canonical_hash(payload),
        "reproducible": physics_result_sha256 is not None,
        "capacity_claim": False,
    }
