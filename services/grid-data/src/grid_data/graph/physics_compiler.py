from __future__ import annotations

from typing import Any

from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import canonical_hash

from .analysis import analyze_topology
from .contracts import GraphProjection


def compile_network_model(
    projection: GraphProjection,
    *,
    connection_bus: str,
    study_year: int,
    provenance: dict[str, Any],
) -> tuple[NetworkModelInput, dict[str, Any]]:
    by_kind: dict[str, list[dict[str, Any]]] = {}
    for node in projection.nodes:
        by_kind.setdefault(node.kind, []).append(dict(node.properties))
    buses = by_kind.get("Bus", [])
    bus_ids = {str(row.get("id")) for row in buses}
    if connection_bus not in bus_ids:
        raise ValueError("Connection bus is absent from the selected graph projection.")
    audit = analyze_topology(projection)
    if not audit["accepted_for_physics"]:
        raise ValueError("Graph projection failed electrical completeness checks.")
    model = NetworkModelInput(
        buses=sorted(buses, key=lambda row: str(row["id"])),
        branches=sorted(by_kind.get("Line", []), key=lambda row: str(row["id"])),
        transformers=sorted(by_kind.get("Transformer", []), key=lambda row: str(row["id"])),
        loads=sorted(by_kind.get("Load", []), key=lambda row: str(row["id"])),
        generators=sorted(by_kind.get("Generator", []), key=lambda row: str(row["id"])),
        switches=sorted(by_kind.get("Switch", []), key=lambda row: str(row["id"])),
        contingencies=sorted(by_kind.get("Contingency", []), key=lambda row: str(row["id"])),
        connection_bus=connection_bus,
        study_year=study_year,
        provenance={**provenance, "graph_projection_sha256": projection.projection_sha256},
        model_id=projection.model_id,
        model_version=projection.model_version,
        validation_class=projection.validation_class,
    )
    manifest = {
        "schema_version": "gridpulse-graph-physics-compile-v1",
        "projection_sha256": projection.projection_sha256,
        "compiled_model_sha256": canonical_hash(model),
        "asset_counts": {key: len(value) for key, value in sorted(by_kind.items())},
        "electrical_completeness_passed": True,
        "physics_execution_required": True,
        "display_as_capacity": False,
    }
    return model, manifest
