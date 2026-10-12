from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from grid_data.graph import (
    RecallPolicy,
    StateAxis,
    analyze_portfolio_interactions,
    build_projection,
    generate_state_space,
    projection_change_impact,
    reproducible_study_bundle,
    states_to_scenarios,
    validate_reduction,
)
from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import PhysicsOutcome


def _model() -> NetworkModelInput:
    payload = json.loads(
        (Path(__file__).parents[1] / "fixtures/synthetic-pilot/network.json").read_text()
    )
    payload.update(
        model_version="group-b", validation_class="synthetic_demonstration", provenance={}
    )
    return NetworkModelInput(**payload)


def _outcome(scenario: str, feasible: bool, constraint: str | None = None) -> PhysicsOutcome:
    return PhysicsOutcome(
        scenario,
        scenario * 64,
        None,
        None,
        feasible,
        None,
        constraint,
        "test",
        "1",
        "synthetic_demonstration",
        True,
    )


def test_state_space_is_bounded_deterministic_and_convertible():
    axes = [
        StateAxis("demand_factor", (0.9, 1.0)),
        StateAxis("switching_state", ("normal", "alternate")),
    ]
    first = generate_state_space(axes)
    second = generate_state_space(axes)
    assert first["generated_count"] == 4
    assert first["state_space_sha256"] == second["state_space_sha256"]
    assert len(states_to_scenarios(first)) == 4
    with pytest.raises(ValueError, match="limit"):
        generate_state_space(axes, maximum_states=3)


def test_recall_guard_fails_closed_when_infeasible_case_is_missed():
    full = [_outcome("a", True), _outcome("b", False, "line-1")]
    result = validate_reduction(full[:1], full, mandatory_scenario_ids=set(), policy=RecallPolicy())
    assert result["accepted_for_search_reduction"] is False
    assert result["infeasible_recall"] == 0


def test_portfolio_overlap_is_not_capacity():
    result = analyze_portfolio_interactions(
        build_projection(_model()), ["synthetic-mv-a", "synthetic-mv-b"], ["synthetic-hv"]
    )
    assert result["pairwise_interactions"][0]["shared_asset_ids"]
    assert result["capacity_claim"] is False


def test_change_impact_and_bundle_are_content_addressed():
    before = build_projection(_model())
    changed_model = replace(
        _model(), branches=tuple({**row, "length_km": 2.0} for row in _model().branches)
    )
    after = build_projection(changed_model)
    impact = projection_change_impact(before, after)
    assert impact["requires_study_invalidation"] is True
    run = {"result_sha256": "a" * 64}
    bundle = reproducible_study_bundle(
        projection=after,
        state_sha256="b" * 64,
        algorithm_runs=[run],
        physics_result_sha256="c" * 64,
    )
    assert bundle["reproducible"] is True
