from __future__ import annotations

from dataclasses import asdict, dataclass

from grid_data.p0_foundation import canonical_hash

from .contracts import GraphProjection


@dataclass(frozen=True)
class TopologyState:
    state_id: str
    switch_positions: dict[str, bool]
    unavailable_assets: tuple[str, ...] = ()
    reason: str = "operator-declared"

    @property
    def sha256(self) -> str:
        return canonical_hash(asdict(self))


def apply_topology_state(projection: GraphProjection, state: TopologyState) -> GraphProjection:
    unavailable = set(state.unavailable_assets)
    controls = {edge.source: edge.target for edge in projection.edges if edge.kind == "CONTROLS"}
    unavailable.update(
        target
        for switch, target in controls.items()
        if not state.switch_positions.get(switch, True)
    )
    edges = tuple(
        edge
        for edge in projection.edges
        if edge.source not in unavailable and edge.target not in unavailable
    )
    return GraphProjection(
        projection.model_id,
        f"{projection.model_version}+{state.state_id}",
        projection.validation_class,
        projection.nodes,
        edges,
        projection.source_sha256,
        canonical_hash(
            {
                "base": projection.projection_sha256,
                "state": state.sha256,
                "edges": [e.external_id for e in edges],
            }
        ),
        {**projection.safety, "topology_state_applied": True},
    )


def topology_diff(before: GraphProjection, after: GraphProjection) -> dict[str, object]:
    a, b = {e.external_id for e in before.edges}, {e.external_id for e in after.edges}
    return {
        "removed_edges": sorted(a - b),
        "added_edges": sorted(b - a),
        "before_sha256": before.projection_sha256,
        "after_sha256": after.projection_sha256,
    }
