from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import canonical_hash


@dataclass(frozen=True)
class GraphNode:
    external_id: str
    kind: str
    properties: dict[str, Any]


@dataclass(frozen=True)
class GraphEdge:
    external_id: str
    source: str
    target: str
    kind: str
    properties: dict[str, Any]


@dataclass(frozen=True)
class GraphProjection:
    model_id: str
    model_version: str
    validation_class: str
    nodes: tuple[GraphNode, ...]
    edges: tuple[GraphEdge, ...]
    source_sha256: str
    projection_sha256: str
    safety: dict[str, bool] = field(
        default_factory=lambda: {
            "physics_verified": False,
            "operator_confirmed": False,
            "display_as_capacity": False,
            "capacity_claim": False,
        }
    )


def build_projection(model: NetworkModelInput) -> GraphProjection:
    if not model.model_id or not model.model_version:
        raise ValueError("A graph projection requires a versioned model identity.")
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    for bus in model.buses:
        nodes.append(GraphNode(str(bus["id"]), "Bus", dict(bus)))
    equipment = (
        ("Line", model.branches, "from_bus", "to_bus"),
        ("Transformer", model.transformers, "hv_bus", "lv_bus"),
    )
    for kind, items, start_key, end_key in equipment:
        for item in items:
            asset_id = str(item["id"])
            nodes.append(GraphNode(asset_id, kind, dict(item)))
            for suffix, bus_key in (("a", start_key), ("b", end_key)):
                edges.append(
                    GraphEdge(
                        f"{asset_id}:terminal:{suffix}",
                        asset_id,
                        str(item[bus_key]),
                        "TERMINAL_AT",
                        {"model_version": model.model_version},
                    )
                )
    for kind, items in (("Load", model.loads), ("Generator", model.generators)):
        for item in items:
            asset_id = str(item["id"])
            nodes.append(GraphNode(asset_id, kind, dict(item)))
            edges.append(
                GraphEdge(
                    f"{asset_id}:terminal",
                    asset_id,
                    str(item["bus"]),
                    "TERMINAL_AT",
                    {"model_version": model.model_version},
                )
            )
    for item in model.switches:
        switch_id = str(item["id"])
        nodes.append(GraphNode(switch_id, "Switch", dict(item)))
        edges.append(
            GraphEdge(
                f"{switch_id}:controls",
                switch_id,
                str(item["element_id"]),
                "CONTROLS",
                {"closed": bool(item.get("closed", True))},
            )
        )
    for item in model.contingencies:
        contingency_id = str(item["id"])
        nodes.append(GraphNode(contingency_id, "Contingency", dict(item)))
        edges.append(
            GraphEdge(
                f"{contingency_id}:outages",
                contingency_id,
                str(item["element_id"]),
                "OUTAGES",
                {},
            )
        )
    source = canonical_hash(asdict(model))
    material = {
        "model_id": model.model_id,
        "model_version": model.model_version,
        "nodes": [asdict(item) for item in sorted(nodes, key=lambda row: row.external_id)],
        "edges": [asdict(item) for item in sorted(edges, key=lambda row: row.external_id)],
    }
    return GraphProjection(
        model.model_id,
        model.model_version,
        model.validation_class,
        tuple(nodes),
        tuple(edges),
        source,
        canonical_hash(material),
    )


def validate_round_trip(projection: GraphProjection, model: NetworkModelInput) -> dict[str, Any]:
    """Prove projection properties can reproduce the model's electrical asset records."""
    projected = {(node.kind, node.external_id): node.properties for node in projection.nodes}
    expected: dict[tuple[str, str], dict[str, Any]] = {}
    for kind, rows in (
        ("Bus", model.buses),
        ("Line", model.branches),
        ("Transformer", model.transformers),
        ("Load", model.loads),
        ("Generator", model.generators),
        ("Switch", model.switches),
        ("Contingency", model.contingencies),
    ):
        expected.update({(kind, str(row["id"])): dict(row) for row in rows})
    missing = sorted(f"{kind}:{key}" for kind, key in expected.keys() - projected.keys())
    changed = sorted(
        f"{kind}:{key}"
        for (kind, key), value in expected.items()
        if projected.get((kind, key)) != value
    )
    return {
        "valid": not missing and not changed,
        "missing_assets": missing,
        "changed_assets": changed,
        "source_sha256_matches": projection.source_sha256 == canonical_hash(asdict(model)),
    }
