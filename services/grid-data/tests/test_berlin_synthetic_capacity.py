import hashlib
import json
from pathlib import Path

from grid_data.berlin_synthetic_capacity import (
    BERLIN_NODES,
    MODEL_VERSION,
    SLACK_NODE_ID,
    build_berlin_synthetic_model,
)


def test_berlin_model_is_meshed_and_explicitly_synthetic():
    model = build_berlin_synthetic_model()

    assert len(model.buses) == 16
    assert len(model.branches) >= len(model.buses)
    assert len(model.contingencies) == len(model.branches)
    assert model.provenance["evidence_class"] == "synthetic_geographic_demonstration"
    assert model.validation_class == "synthetic_demonstration"
    assert [item["bus"] for item in model.generators if item.get("slack")] == [SLACK_NODE_ID]


def test_committed_release_artifact_is_safe_and_complete():
    root = Path(__file__).resolve().parents[3]
    artifact = json.loads(
        (root / "public" / "power-finder" / "berlin-synthetic-capacity.json").read_text(
            encoding="utf-8"
        )
    )

    assert artifact["schema_version"] == "gridpulse-berlin-synthetic-capacity-v1"
    assert artifact["result_mode"] == "synthetic_geographic_demonstration"
    assert artifact["model"]["version"] == MODEL_VERSION
    assert len(artifact["results"]) == len(BERLIN_NODES) - 1
    assert artifact["coverage"]["features"][0]["properties"]["calculated_node_count"] == 15
    assert SLACK_NODE_ID not in {result["publicNodeId"] for result in artifact["results"]}
    assert all(
        result["n0CapacityMw"] is None
        or result["firmCapacityMw"] <= result["n0CapacityMw"]
        for result in artifact["results"]
    )
    assert all(
        result["evidenceClass"] == "synthetic_geographic_demonstration"
        for result in artifact["results"]
    )
    assert artifact["results_sha256"] == hashlib.sha256(
        json.dumps(artifact["results"], sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert "Not available capacity" in artifact["prohibited_interpretation"]
