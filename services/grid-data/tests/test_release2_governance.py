import hashlib
import json
from pathlib import Path

from grid_data.pilot_providers import SyntheticPilotDataProvider

ROOT = Path(__file__).resolve().parents[3]


def test_release2_fixture_manifest_is_immutable_and_loadable():
    package = ROOT / "services" / "grid-data" / "fixtures" / "synthetic-pilot"
    bundle = SyntheticPilotDataProvider(package).load()

    assert bundle.manifest.provenance.validation_class == "synthetic_demonstration"
    assert bundle.manifest.provenance.is_synthetic is True


def test_public_release2_manifest_is_hash_bound_and_governance_only():
    artifact = json.loads(
        (ROOT / "public" / "power-finder" / "release2-governance.json").read_text(
            encoding="utf-8"
        )
    )
    claimed_hash = artifact.pop("manifest_sha256")
    actual_hash = hashlib.sha256(
        json.dumps(artifact, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()

    assert claimed_hash == actual_hash
    assert artifact["capacity_claim"] is False
    assert artifact["public_visibility"] == "governance_summary_only"
    assert artifact["active_learning"]["physics_coverage"] == 1.0
    assert artifact["active_learning"]["mandatory_contingency_coverage"] == 1.0
    assert artifact["active_learning"]["unverified_selected_count"] == 0
    assert artifact["berlin_release1_boundary"]["surrogate_applied_to_public_capacity"] is False
    assert artifact["berlin_release1_boundary"]["map_values_remain_physics_results"] is True
    assert "predictions" not in artifact
    assert artifact["artifact"]["publicly_downloadable"] is False


def test_release2_governance_is_bound_to_committed_release1_artifact():
    release1 = json.loads(
        (ROOT / "public" / "power-finder" / "berlin-synthetic-capacity.json").read_text(
            encoding="utf-8"
        )
    )
    release2 = json.loads(
        (ROOT / "public" / "power-finder" / "release2-governance.json").read_text(
            encoding="utf-8"
        )
    )
    boundary = release2["berlin_release1_boundary"]

    assert boundary["release1_model_version"] == release1["model"]["version"]
    assert boundary["release1_model_sha256"] == release1["model"]["model_sha256"]
    assert boundary["release1_results_sha256"] == release1["results_sha256"]
