import csv

from grid_data.c4_operator_pilot import (
    build_pilot_readiness,
    parse_scada_csv,
    reconcile_measurements,
)


def test_scada_and_reconciliation(tmp_path) -> None:
    path = tmp_path / "scada.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["timestamp", "element_id", "active_power_mw", "voltage_pu", "quality"])
        writer.writeheader()
        writer.writerow({"timestamp": "2028-01-01T00:00:00Z", "element_id": "bus-1", "active_power_mw": 10, "voltage_pu": 1.0, "quality": "good"})
    observations, manifest = parse_scada_csv(path)
    result = reconcile_measurements(
        observations,
        [{"timestamp": observations[0].timestamp, "element_id": "bus-1", "active_power_mw": 10.2, "voltage_pu": 0.995}],
        active_power_mae_limit_mw=0.5,
    )
    assert manifest["quality"]["accepted_for_reconciliation"]
    assert result["promotion_allowed"]
    assert result["metrics"]["missing_data_rate"] == 0


def test_pilot_cannot_be_confirmed_without_signed_agreement() -> None:
    manifests = [{"package_type": item} for item in ("cgmes", "scada", "ratings", "contingencies")]
    result = build_pilot_readiness(manifests, {"promotion_allowed": True}, None)
    assert result["ready_for_operator_review"]
    assert not result["operator_confirmed"]
    assert "written_data_use_agreement_recorded" in result["missing"]
    assert "capacity_representation_permission_recorded" in result["missing"]
