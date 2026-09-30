from __future__ import annotations

from dataclasses import asdict
from typing import Any

from grid_data.p0_foundation import PhysicsOutcome, canonical_hash

from .contracts import GraphEdge, GraphNode, GraphProjection


def attach_physics_outcomes(
    projection: GraphProjection, outcomes: list[PhysicsOutcome]
) -> dict[str, Any]:
    unverified = sorted(row.scenario_id for row in outcomes if not row.physics_verified)
    if unverified:
        raise ValueError(f"Unverified physics outcomes cannot be attached: {', '.join(unverified)}")
    assets = {node.external_id for node in projection.nodes}
    constraint_nodes: list[GraphNode] = []
    relationships: list[GraphEdge] = []
    records = []
    unresolved_constraints: set[str] = set()
    for outcome in sorted(outcomes, key=lambda row: row.scenario_id):
        constraint = outcome.binding_constraint
        if constraint and constraint not in assets:
            unresolved_constraints.add(constraint)
        result_id = f"physics:{outcome.input_hash}"
        constraint_nodes.append(
            GraphNode(
                result_id,
                "PhysicsResult",
                {
                    **asdict(outcome),
                    "projection_sha256": projection.projection_sha256,
                    "stale": False,
                },
            )
        )
        if constraint in assets:
            relationships.append(
                GraphEdge(
                    f"{result_id}:binds:{constraint}",
                    result_id,
                    constraint,
                    "BOUND_BY",
                    {"physics_verified": True},
                )
            )
        records.append(asdict(outcome))
    payload = {
        "projection_sha256": projection.projection_sha256,
        "outcomes": records,
        "result_nodes": [asdict(row) for row in constraint_nodes],
        "constraint_relationships": [asdict(row) for row in relationships],
        "unresolved_constraint_labels": sorted(unresolved_constraints),
    }
    return {
        **payload,
        "attachment_sha256": canonical_hash(payload),
        "physics_verified": True,
        "operator_confirmed": False,
    }


def attachment_status(attachment: dict[str, Any], current_projection_sha256: str) -> dict[str, Any]:
    stale = attachment["projection_sha256"] != current_projection_sha256
    return {
        "stale": stale,
        "usable_for_current_model": not stale,
        "reason": "projection_changed" if stale else None,
        "attachment_sha256": attachment["attachment_sha256"],
    }
