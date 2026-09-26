from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_public_release3_manifest_is_reproducible_and_governance_only() -> None:
    path = ROOT / "public" / "power-finder" / "release3-governance.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    expected = document.pop("manifest_sha256")
    actual = hashlib.sha256(
        json.dumps(document, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert actual == expected
    assert "observations" not in document
    assert "surrogate_prediction_mw" not in json.dumps(document)
    assert document["private_observations_published"] is False
    assert document["private_predictions_published"] is False


def test_release3_public_boundary_remains_physics_authoritative() -> None:
    document = json.loads(
        (ROOT / "public" / "power-finder" / "release3-governance.json").read_text(
            encoding="utf-8"
        )
    )
    assert document["shadow"]["physics_coverage"] == 1
    assert document["shadow"]["mandatory_contingency_coverage"] == 1
    assert document["shadow"]["unverified_scenario_count"] == 0
    assert document["champion_decision"]["decision"] == "retain_challenger"
    boundary = document["public_capacity_boundary"]
    assert boundary["surrogate_applied_to_public_capacity"] is False
    assert boundary["map_values_remain_physics_results"] is True
    assert boundary["operator_confirmation_created"] is False
