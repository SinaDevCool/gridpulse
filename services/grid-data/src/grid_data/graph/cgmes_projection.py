from __future__ import annotations

from dataclasses import asdict

from grid_data.p0_foundation import canonical_hash

from .cgmes import CgmesPackage
from .contracts import GraphEdge, GraphNode, GraphProjection


def project_cgmes(package: CgmesPackage) -> GraphProjection:
    nodes = tuple(
        GraphNode(
            entity.mrid, entity.kind, {**entity.properties, "cgmes_profiles": list(entity.profiles)}
        )
        for entity in package.entities
    )
    edges = tuple(
        GraphEdge(
            f"{entity.mrid}:{name}:{target}",
            entity.mrid,
            target,
            name.upper(),
            {"cgmes_reference": True},
        )
        for entity in package.entities
        for name, target in sorted(entity.references.items())
    )
    material = {
        "model_id": package.model_id,
        "version": package.version,
        "nodes": [asdict(n) for n in nodes],
        "edges": [asdict(e) for e in edges],
    }
    return GraphProjection(
        package.model_id,
        package.version,
        "operator_model_unvalidated",
        nodes,
        edges,
        package.source_sha256,
        canonical_hash(material),
    )


def validate_cgmes_round_trip(
    package: CgmesPackage, projection: GraphProjection
) -> dict[str, object]:
    expected = {(e.mrid, e.kind) for e in package.entities}
    actual = {(n.external_id, n.kind) for n in projection.nodes}
    refs = {(e.source, e.target, e.kind) for e in projection.edges}
    expected_refs = {
        (e.mrid, target, name.upper())
        for e in package.entities
        for name, target in e.references.items()
    }
    return {
        "valid": expected == actual and refs == expected_refs,
        "missing_entities": sorted(expected - actual),
        "missing_references": sorted(expected_refs - refs),
        "display_as_capacity": False,
    }
