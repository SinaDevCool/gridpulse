import json
import shutil
from dataclasses import replace
from hashlib import sha256
from pathlib import Path

import pytest

from grid_data.contracts import ProvenanceRecord
from grid_data.pilot_providers import OperatorPilotDataProvider, SyntheticPilotDataProvider

FIXTURE = Path(__file__).parents[1] / "fixtures" / "synthetic-pilot"


def test_synthetic_provider_returns_complete_three_year_replaceable_bundle():
    bundle = SyntheticPilotDataProvider(FIXTURE).load()
    assert bundle.manifest.provenance.is_synthetic
    assert bundle.manifest.provenance.validation_class == "synthetic_demonstration"
    assert bundle.manifest.provenance.replacement_contract == "operator_pilot_data_v1"
    assert len(bundle.observations) == 365 * 24 + 366 * 24 + 365 * 24
    assert len({item.timestamp[:4] for item in bundle.observations}) == 3
    assert bundle.network_model.connection_bus == "synthetic-mv-b"
    assert bundle.queue and bundle.reinforcements and bundle.contingencies
    assert len(bundle.dataset_hash) == 64


def test_checksum_tampering_fails_closed(tmp_path):
    target = tmp_path / "pilot"
    shutil.copytree(FIXTURE, target)
    (target / "queue.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum"):
        SyntheticPilotDataProvider(target).load()


def test_synthetic_provenance_cannot_be_promoted():
    provenance = SyntheticPilotDataProvider(FIXTURE).load().manifest.provenance
    with pytest.raises(ValueError, match="cannot be promoted"):
        replace(provenance, validation_class="operator_confirmed").validate()


def test_operator_provider_rejects_synthetic_package():
    with pytest.raises(ValueError, match="wrong evidence class"):
        OperatorPilotDataProvider(FIXTURE).load()


def test_operator_provenance_requires_controlled_source_reference():
    provenance = ProvenanceRecord(
        evidence_class="operator_supplied",
        validation_class="operator_model_unvalidated",
        is_synthetic=False,
        source_id="operator-pilot-1",
        source_url=None,
        source_published_at=None,
        model_version="operator-model-v1",
        replacement_contract="operator_pilot_data_v1",
        license="Signed pilot data-use agreement",
    )
    with pytest.raises(ValueError, match="controlled source"):
        provenance.validate()


def test_unknown_contract_fields_are_rejected(tmp_path):
    target = tmp_path / "pilot"
    shutil.copytree(FIXTURE, target)
    queue = json.loads((target / "queue.json").read_text(encoding="utf-8"))
    queue[0]["mystery"] = True
    (target / "queue.json").write_text(json.dumps(queue), encoding="utf-8")
    manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    manifest["file_hashes"]["queue.json"] = sha256((target / "queue.json").read_bytes()).hexdigest()
    (target / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="Unknown ConnectionQueueEntry fields"):
        SyntheticPilotDataProvider(target).load()


def test_operator_package_uses_the_same_bundle_contract(tmp_path):
    target = tmp_path / "operator-pilot"
    shutil.copytree(FIXTURE, target)
    queue = json.loads((target / "queue.json").read_text(encoding="utf-8"))
    for item in queue:
        item["status"] = "accepted"
        item["is_synthetic"] = False
    (target / "queue.json").write_text(json.dumps(queue), encoding="utf-8")
    for filename in (
        "reinforcements.json",
        "contingencies.json",
        "switching-states.json",
        "planned-outages.json",
        "customer-profiles.json",
        "flexibility-assets.json",
    ):
        rows = json.loads((target / filename).read_text(encoding="utf-8"))
        for item in rows:
            item["is_synthetic"] = False
        (target / filename).write_text(json.dumps(rows), encoding="utf-8")
    criteria = json.loads((target / "security-criteria.json").read_text(encoding="utf-8"))
    criteria["is_synthetic"] = False
    criteria["criteria_source"] = "Controlled operator pilot criteria"
    (target / "security-criteria.json").write_text(json.dumps(criteria), encoding="utf-8")
    observations = {
        "rows": [
            {
                "timestamp": "2025-01-01T00:00:00Z",
                "element_id": "synthetic-trafo-1",
                "active_power_mw": 30,
                "quality": "good",
            }
        ]
    }
    (target / "observations.json").write_text(json.dumps(observations), encoding="utf-8")
    manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    manifest["warning"] = (
        "Controlled operator pilot package; validation and approval remain pending."
    )
    manifest["provenance"].update(
        {
            "evidence_class": "operator_supplied",
            "validation_class": "operator_model_unvalidated",
            "is_synthetic": False,
            "source_id": "operator-pilot-test",
            "source_url": "controlled://operator-data-room/test",
            "license": "Signed test data-use agreement",
        }
    )
    for filename in manifest["file_hashes"]:
        manifest["file_hashes"][filename] = sha256((target / filename).read_bytes()).hexdigest()
    (target / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    bundle = OperatorPilotDataProvider(target).load()
    assert bundle.manifest.provenance.evidence_class == "operator_supplied"
    assert bundle.network_model.validation_class == "operator_model_unvalidated"
    assert len(bundle.observations) == 1
