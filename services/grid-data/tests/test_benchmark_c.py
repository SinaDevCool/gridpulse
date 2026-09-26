import json
from base64 import b64encode

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from grid_data.benchmark_c import (
    SCHEMA_VERSION,
    _trusted_signature_valid,
    build_benchmark_c_artifact,
)


def test_benchmark_c_synthetic_rehearsal_passes_without_operator_promotion(tmp_path):
    output = tmp_path / "benchmark-c.json"
    report = build_benchmark_c_artifact(output)

    assert report["schema_version"] == SCHEMA_VERSION
    assert report["mode"] == "synthetic_rehearsal"
    assert report["numerical_reconciliation_passed"] is True
    assert report["benchmark_execution_passed"] is True
    assert report["operator_validation_passed"] is False
    assert report["validation_class"] == "synthetic_demonstration"
    assert report["capacity_claim"] is False
    assert report["display_as_capacity"] is False
    assert json.loads(output.read_text(encoding="utf-8"))["benchmark_sha256"] == report[
        "benchmark_sha256"
    ]


def test_benchmark_c_requires_all_external_inputs(tmp_path):
    observed = tmp_path / "observed.json"
    observed.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="together"):
        build_benchmark_c_artifact(tmp_path / "bad.json", observed_path=observed)


def test_benchmark_c_missing_channels_fails_closed(tmp_path):
    observed = [
        {
            "timestamp": "2026-01-01T00:00:00+00:00",
            "element_id": "bus-1",
            "active_power_mw": 1.0,
            "quality": "good",
        }
    ]
    simulated = [
        {
            "timestamp": "2026-01-01T00:00:00+00:00",
            "element_id": "bus-1",
            "active_power_mw": 1.0,
        }
    ]
    evidence = {"evidence_origin": "operator_supplied"}
    paths = []
    for name, payload in (("observed", observed), ("simulated", simulated), ("evidence", evidence)):
        path = tmp_path / f"{name}.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        paths.append(path)
    report = build_benchmark_c_artifact(
        tmp_path / "result.json",
        observed_path=paths[0],
        simulated_path=paths[1],
        evidence_path=paths[2],
        minimum_observations=1,
    )
    assert report["numerical_reconciliation_passed"] is False
    assert report["operator_validation_passed"] is False
    assert report["validation_class"] == "operator_model_unvalidated"


def test_benchmark_c_verifies_evidence_against_separate_trust_anchor(tmp_path):
    private_key = Ed25519PrivateKey.generate()
    public_key_path = tmp_path / "trusted.pem"
    public_key_path.write_bytes(
        private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    evidence = {"evidence_origin": "operator_supplied", "operator_authorized": True}
    payload = json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode()
    evidence["signature_base64"] = b64encode(private_key.sign(payload)).decode()

    assert _trusted_signature_valid(evidence, public_key_path) is True
    evidence["operator_authorized"] = False
    assert _trusted_signature_valid(evidence, public_key_path) is False
