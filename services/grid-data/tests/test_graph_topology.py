from __future__ import annotations

import json
from pathlib import Path

import pytest

from grid_data.graph import (
    analyze_topology,
    build_projection,
    candidate_pathways,
    select_graph_guided_scenarios,
    validate_round_trip,
)
from grid_data.graph.operator_pilot import OperatorGraphAuthorization, validate_operator_projection
from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import ScenarioDefinition


def model() -> NetworkModelInput:
    payload = json.loads((Path(__file__).parents[1] / "fixtures/synthetic-pilot/network.json").read_text())
    payload.update(model_version="v1", validation_class="synthetic_demonstration",
                   provenance={"source_url": "https://simbench.de", "license": "ODbL-1.0"})
    return NetworkModelInput(**payload)


def test_projection_is_deterministic_and_never_capacity() -> None:
    first, second = build_projection(model()), build_projection(model())
    assert first.projection_sha256 == second.projection_sha256
    assert not first.safety["display_as_capacity"]
    assert {node.kind for node in first.nodes} >= {"Bus", "Line", "Transformer"}
    assert validate_round_trip(first, model())["valid"]


def test_topology_audit_and_pathways_find_radial_critical_assets() -> None:
    projection = build_projection(model())
    audit = analyze_topology(projection)
    assert audit["accepted_for_physics"]
    assert set(audit["bridge_assets"]) == {"synthetic-line-a-b", "synthetic-trafo-1"}
    result = candidate_pathways(projection, "synthetic-mv-b", ["synthetic-hv"])
    assert result["pathways"][0]["asset_ids"] == ["synthetic-line-a-b", "synthetic-trafo-1"]
    assert not result["capacity_claim"]


def test_graph_selector_preserves_mandatory_cases() -> None:
    rows = [ScenarioDefinition(f"s-{i}", contingency_id=f"asset-{i}") for i in range(5)]
    result = select_graph_guided_scenarios(
        scenarios=rows, mandatory_contingencies={"asset-4"},
        relevant_assets={"asset-2"}, budget=3,
    )
    assert "s-4" in result["selected_scenario_ids"]
    assert result["selected_scenario_ids"][0] == "s-4"
    with pytest.raises(ValueError):
        select_graph_guided_scenarios(scenarios=rows, mandatory_contingencies={"missing"},
                                      relevant_assets=set(), budget=2)


def test_operator_projection_requires_separate_authorisation() -> None:
    payload = model()
    object.__setattr__(payload, "validation_class", "operator_model_unvalidated")
    projection = build_projection(payload)
    with pytest.raises(PermissionError):
        validate_operator_projection(projection, None)
    result = validate_operator_projection(projection, OperatorGraphAuthorization(
        "synthetic-workspace", True, True, False, "a" * 64,
    ))
    assert result["derived_metrics_allowed"]
    assert not result["model_training_allowed"]
    assert not result["capacity_claim"]
