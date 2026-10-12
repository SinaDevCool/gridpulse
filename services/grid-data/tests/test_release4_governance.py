from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def release4() -> dict:
    return json.loads(
        (ROOT / "public" / "power-finder" / "release4-governance.json").read_text(
            encoding="utf-8"
        )
    )


def test_release4_manifest_is_reproducible_and_governance_only() -> None:
    document = release4()
    expected = document.pop("manifest_sha256")
    actual = hashlib.sha256(
        json.dumps(document, sort_keys=True, default=str).encode()
    ).hexdigest()
    assert actual == expected
    assert document["private_operator_data_published"] is False
    assert document["private_physics_outcomes_published"] is False
    assert "selected_physics_outcomes" not in document


def test_release4_qualification_and_public_boundary_pass() -> None:
    document = release4()
    graph = document["graph_and_physics"]
    assert document["repository_acceptance"]["all_repository_gates_passed"] is True
    assert graph["selected_case_count"] < graph["full_case_count"]
    assert graph["infeasible_recall"] == 1
    assert graph["constraint_recall"] == 1
    assert graph["false_safe_rate"] == 0
    assert graph["reduced_search_qualified"] is True
    boundary = document["public_capacity_boundary"]
    assert boundary["graph_results_applied_to_public_capacity"] is False
    assert boundary["map_values_remain_physics_results"] is True
    assert boundary["operator_confirmation_created"] is False
