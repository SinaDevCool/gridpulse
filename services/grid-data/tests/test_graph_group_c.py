from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from grid_data.graph import (
    OperatorReviewEvidence,
    attach_physics_outcomes,
    attachment_status,
    build_contingency_plan,
    build_projection,
    compile_network_model,
    evaluate_promotion,
)
from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import PhysicsOutcome


def _model() -> NetworkModelInput:
    payload = json.loads(
        (Path(__file__).parents[1] / "fixtures/synthetic-pilot/network.json").read_text()
    )
    payload.update(
        model_version="group-c", validation_class="synthetic_demonstration", provenance={}
    )
    return NetworkModelInput(**payload)


def test_graph_compiles_back_to_electrically_complete_model():
    original = _model()
    compiled, manifest = compile_network_model(
        build_projection(original),
        connection_bus=original.connection_bus,
        study_year=2030,
        provenance={"authority": "test"},
    )
    assert compiled.branches == original.branches
    assert manifest["electrical_completeness_passed"] is True
    assert compiled.provenance["graph_projection_sha256"]


def test_contingency_plan_preserves_mandatory_and_bounds_expansion():
    projection = build_projection(_model())
    contingency_id = str(_model().contingencies[0]["id"])
    plan = build_contingency_plan(projection, mandatory_contingency_ids={contingency_id})
    assert plan["mandatory_scenario_ids"]
    assert plan["operator_switching_approval_required"] is True
    with pytest.raises(ValueError, match="limit"):
        build_contingency_plan(projection, mandatory_contingency_ids=set(), maximum_cases=1)


def test_only_verified_physics_can_be_attached_and_changes_make_it_stale():
    projection = build_projection(_model())
    constraint = str(_model().branches[0]["id"])
    verified = PhysicsOutcome(
        "s1",
        "a" * 64,
        10,
        5,
        True,
        "base",
        constraint,
        "pandapower",
        "3",
        "synthetic_demonstration",
        True,
    )
    attachment = attach_physics_outcomes(projection, [verified])
    assert attachment_status(attachment, projection.projection_sha256)["stale"] is False
    assert attachment_status(attachment, "b" * 64)["stale"] is True
    with pytest.raises(ValueError, match="Unverified"):
        attach_physics_outcomes(projection, [replace(verified, physics_verified=False)])


def test_operator_confirmation_requires_all_evidence_and_signature():
    evidence = OperatorReviewEvidence(
        "pilot",
        "engineer",
        "2026-08-09T00:00:00+02:00",
        "a" * 64,
        "b" * 64,
        "c" * 64,
        1,
        1,
        True,
        False,
    )
    assert (
        evaluate_promotion(evidence, requested_class="operator_confirmed")["decision"] == "rejected"
    )
    approved = evaluate_promotion(
        replace(evidence, operator_signed=True), requested_class="operator_confirmed"
    )
    assert approved["decision"] == "approved"
    assert approved["operator_confirmation_created"] is True
